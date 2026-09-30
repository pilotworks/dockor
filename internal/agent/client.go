package agent

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	"github.com/moby/moby/client"
	"github.com/pilotworks/dockor/internal/docker"
	"github.com/pilotworks/dockor/internal/version"
)

// ClientConfig holds configuration for running dockor-agent
type ClientConfig struct {
	ServerURL         string
	EnrollmentToken   string
	DockerHost        string
	FriendlyName      string
	HeartbeatInterval time.Duration
	InsecureSkipTLS   bool
}

// AgentClient coordinates handshake, reverse tunnel, telemetry, and RPC command execution
type AgentClient struct {
	cfg          ClientConfig
	mobyCli      *client.Client
	nodeID       string
	sessionToken string
	tunnelURL    string
	conn         *websocket.Conn
	writeMu      sync.Mutex
	closed       atomic.Bool
	httpClient   *http.Client
}

// NewAgentClient initializes a dockor-agent client instance
func NewAgentClient(cfg ClientConfig) (*AgentClient, error) {
	if cfg.ServerURL == "" {
		return nil, errors.New("server url is required")
	}

	// Auto-resolve Docker host socket if unspecified
	if cfg.DockerHost == "" {
		cfg.DockerHost = docker.ResolveDockerHost()
	}

	if cfg.HeartbeatInterval <= 0 {
		cfg.HeartbeatInterval = time.Duration(DefaultHeartbeatSec) * time.Second
	}

	// Initialize Moby Docker client
	opts := []client.Opt{
		client.WithHost(cfg.DockerHost),
		client.WithAPIVersionNegotiation(),
	}
	mobyCli, err := client.NewClientWithOpts(opts...)
	if err != nil {
		log.Printf("[Agent] Warning: unable to connect to Docker socket (%s): %v", cfg.DockerHost, err)
	}

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: cfg.InsecureSkipTLS},
	}
	httpClient := &http.Client{
		Transport: tr,
		Timeout:   15 * time.Second,
	}

	return &AgentClient{
		cfg:        cfg,
		mobyCli:    mobyCli,
		httpClient: httpClient,
	}, nil
}

// Start runs the agent connection and auto-reconnection loop
func (c *AgentClient) Start(ctx context.Context) error {
	log.Printf("[Agent] Starting Dockor agent v%s connecting to %s", version.Version, c.cfg.ServerURL)
	var attempt int

	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		err := c.runSession(ctx)
		if ctx.Err() != nil {
			return ctx.Err()
		}

		attempt++
		// Exponential backoff with jitter: min(60s, 2^attempt * 1s) + jitter
		backoffSec := 1 << attempt
		if backoffSec > 60 {
			backoffSec = 60
		}
		jitter := time.Duration(rand.Intn(1000)) * time.Millisecond
		delay := time.Duration(backoffSec)*time.Second + jitter

		log.Printf("[Agent] Tunnel session ended (%v). Reconnecting in %v (attempt %d)...", err, delay.Round(time.Millisecond), attempt)

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
		}
	}
}

// Stop closes the active agent connection
func (c *AgentClient) Stop() {
	c.closed.Store(true)
	c.writeMu.Lock()
	if c.conn != nil {
		_ = c.conn.Close()
	}
	c.writeMu.Unlock()
}

// runSession performs handshake, dials WebSocket tunnel, and handles telemetry + RPC
func (c *AgentClient) runSession(ctx context.Context) error {
	// 1. Perform Handshake
	hsResp, err := c.handshake(ctx)
	if err != nil {
		return fmt.Errorf("handshake failed: %w", err)
	}

	c.nodeID = hsResp.NodeID
	c.sessionToken = hsResp.SessionToken
	log.Printf("[Agent] Handshake successful! Assigned Node ID: %s", c.nodeID)

	// 2. Establish Reverse WebSocket Tunnel
	tunnelURL, err := c.resolveTunnelURL(hsResp.TunnelEndpoint)
	if err != nil {
		return fmt.Errorf("invalid tunnel url: %w", err)
	}

	dialer := websocket.Dialer{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: c.cfg.InsecureSkipTLS},
	}

	header := http.Header{}
	header.Set("Authorization", "Bearer "+c.sessionToken)

	log.Printf("[Agent] Dialing reverse tunnel: %s", tunnelURL)
	conn, resp, err := dialer.DialContext(ctx, tunnelURL, header)
	if err != nil {
		if resp != nil {
			body, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("tunnel dial failed (status %d): %s, %w", resp.StatusCode, string(body), err)
		}
		return fmt.Errorf("tunnel dial failed: %w", err)
	}
	defer conn.Close()

	c.writeMu.Lock()
	c.conn = conn
	c.writeMu.Unlock()
	log.Printf("[Agent] Tunnel established successfully!")

	sessionCtx, cancelSession := context.WithCancel(ctx)
	defer cancelSession()

	// 3. Start Telemetry Loop
	hbInterval := time.Duration(hsResp.HeartbeatIntervalSec) * time.Second
	if hbInterval <= 0 {
		hbInterval = c.cfg.HeartbeatInterval
	}

	go func() {
		ticker := time.NewTicker(hbInterval)
		defer ticker.Stop()

		// Send initial telemetry frame immediately
		_ = c.sendTelemetry(sessionCtx)

		for {
			select {
			case <-sessionCtx.Done():
				return
			case <-ticker.C:
				if err := c.sendTelemetry(sessionCtx); err != nil {
					log.Printf("[Agent] Warning: telemetry send error: %v", err)
				}
			}
		}
	}()

	// 4. Message Reader Loop
	for {
		msgType, data, err := conn.ReadMessage()
		if err != nil {
			return fmt.Errorf("connection read error: %w", err)
		}

		if msgType == websocket.BinaryMessage {
			go func(d []byte) {
				if err := c.handleIncomingFrame(sessionCtx, d); err != nil {
					log.Printf("[Agent] Frame handling error: %v", err)
				}
			}(data)
		}
	}
}

// handshake contacts the control plane with enrollment token and local host specs
func (c *AgentClient) handshake(ctx context.Context) (*HandshakeResponse, error) {
	hostname, _ := os.Hostname()
	dockerVersion := "unknown"
	var totalMem int64

	if c.mobyCli != nil {
		if infoRes, err := c.mobyCli.Info(ctx, client.InfoOptions{}); err == nil {
			info := infoRes.Info
			if info.ServerVersion != "" {
				dockerVersion = info.ServerVersion
			}
			totalMem = info.MemTotal
		}
	}

	reqBody := HandshakeRequest{
		EnrollmentToken:  c.cfg.EnrollmentToken,
		Hostname:         hostname,
		FriendlyName:     c.cfg.FriendlyName,
		AgentVersion:     version.Version,
		OS:               runtime.GOOS,
		Arch:             runtime.GOARCH,
		DockerVersion:    dockerVersion,
		TotalMemoryBytes: totalMem,
		CPUCores:         runtime.NumCPU(),
	}

	reqJSON, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	hsEndpoint := strings.TrimRight(c.cfg.ServerURL, "/") + "/api/v1/agent/handshake"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, hsEndpoint, bytes.NewReader(reqJSON))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	httpResp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer httpResp.Body.Close()

	if httpResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(httpResp.Body)
		return nil, fmt.Errorf("handshake rejected (status %d): %s", httpResp.StatusCode, string(body))
	}

	var hsResp HandshakeResponse
	if err := json.NewDecoder(httpResp.Body).Decode(&hsResp); err != nil {
		return nil, fmt.Errorf("failed to parse handshake response: %w", err)
	}

	return &hsResp, nil
}

// resolveTunnelURL normalizes the WebSocket tunnel URL
func (c *AgentClient) resolveTunnelURL(endpoint string) (string, error) {
	parsed, err := url.Parse(c.cfg.ServerURL)
	if err != nil {
		return "", err
	}

	wsScheme := "ws"
	if parsed.Scheme == "https" || parsed.Scheme == "wss" {
		wsScheme = "wss"
	}

	if strings.HasPrefix(endpoint, "ws://") || strings.HasPrefix(endpoint, "wss://") {
		return endpoint, nil
	}

	if !strings.HasPrefix(endpoint, "/") {
		endpoint = "/" + endpoint
	}

	return fmt.Sprintf("%s://%s%s?token=%s", wsScheme, parsed.Host, endpoint, url.QueryEscape(c.sessionToken)), nil
}

// sendTelemetry collects metrics and writes a StreamTypeTelemetry frame
func (c *AgentClient) sendTelemetry(ctx context.Context) error {
	var running, paused, stopped, total, imgCount int
	var dockerVer string
	var memUsed, memTotal int64

	if c.mobyCli != nil {
		if containers, err := c.mobyCli.ContainerList(ctx, client.ContainerListOptions{All: true}); err == nil {
			total = len(containers.Items)
			for _, item := range containers.Items {
				switch strings.ToLower(string(item.State)) {
				case "running":
					running++
				case "paused":
					paused++
				default:
					stopped++
				}
			}
		}

		if images, err := c.mobyCli.ImageList(ctx, client.ImageListOptions{}); err == nil {
			imgCount = len(images.Items)
		}

		if infoRes, err := c.mobyCli.Info(ctx, client.InfoOptions{}); err == nil {
			dockerVer = infoRes.Info.ServerVersion
			memTotal = infoRes.Info.MemTotal
		}
	}

	tel := TelemetryPayload{
		CPUPercent:        0.0, // Calculated by server or local sampler
		MemoryUsedBytes:   memUsed,
		MemoryTotalBytes:  memTotal,
		ContainersRunning: running,
		ContainersPaused:  paused,
		ContainersStopped: stopped,
		ContainersTotal:   total,
		ImagesCount:       imgCount,
		DockerVersion:     dockerVer,
		Timestamp:         time.Now().Unix(),
	}

	payload, err := json.Marshal(tel)
	if err != nil {
		return err
	}

	frame := Frame{
		Version:    ProtocolVersion,
		StreamType: StreamTypeTelemetry,
		Flags:      0,
		StreamID:   0,
		Payload:    payload,
	}

	return c.writeFrame(frame)
}

// handleIncomingFrame decodes frames from the server and dispatches RPC commands
func (c *AgentClient) handleIncomingFrame(ctx context.Context, data []byte) error {
	frame, err := DecodeFrame(data)
	if err != nil {
		return err
	}

	if frame.StreamType == StreamTypeControl {
		var req RPCRequest
		if err := json.Unmarshal(frame.Payload, &req); err != nil {
			return err
		}

		res, rpcErr := c.executeRPC(ctx, &req)
		var resRaw json.RawMessage
		if res != nil {
			resBytes, _ := json.Marshal(res)
			resRaw = resBytes
		}

		rpcResp := RPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result:  resRaw,
			Error:   rpcErr,
		}

		respBytes, err := json.Marshal(rpcResp)
		if err != nil {
			return err
		}

		respFrame := Frame{
			Version:    ProtocolVersion,
			StreamType: StreamTypeControl,
			Flags:      0,
			StreamID:   frame.StreamID,
			Payload:    respBytes,
		}

		return c.writeFrame(respFrame)
	}

	return nil
}

// executeRPC handles commands from the Dockor server
func (c *AgentClient) executeRPC(ctx context.Context, req *RPCRequest) (interface{}, *RPCError) {
	if c.mobyCli == nil && req.Method != "ping" {
		return nil, &RPCError{Code: -32001, Message: "docker daemon connection is not available"}
	}

	switch req.Method {
	case "ping":
		return map[string]interface{}{
			"pong":      true,
			"node_id":   c.nodeID,
			"timestamp": time.Now().UnixMilli(),
		}, nil

	case "system.info":
		infoRes, err := c.mobyCli.Info(ctx, client.InfoOptions{})
		if err != nil {
			return nil, &RPCError{Code: -32000, Message: err.Error()}
		}
		return infoRes.Info, nil

	case "container.list":
		containers, err := c.mobyCli.ContainerList(ctx, client.ContainerListOptions{All: true})
		if err != nil {
			return nil, &RPCError{Code: -32000, Message: err.Error()}
		}
		return containers.Items, nil

	case "container.start":
		var p struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil || p.ID == "" {
			return nil, &RPCError{Code: -32602, Message: "container id required"}
		}
		if _, err := c.mobyCli.ContainerStart(ctx, p.ID, client.ContainerStartOptions{}); err != nil {
			return nil, &RPCError{Code: -32000, Message: err.Error()}
		}
		return map[string]string{"status": "started"}, nil

	case "container.stop":
		var p struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil || p.ID == "" {
			return nil, &RPCError{Code: -32602, Message: "container id required"}
		}
		timeout := 10
		if _, err := c.mobyCli.ContainerStop(ctx, p.ID, client.ContainerStopOptions{Timeout: &timeout}); err != nil {
			return nil, &RPCError{Code: -32000, Message: err.Error()}
		}
		return map[string]string{"status": "stopped"}, nil

	case "container.restart":
		var p struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil || p.ID == "" {
			return nil, &RPCError{Code: -32602, Message: "container id required"}
		}
		timeout := 10
		if _, err := c.mobyCli.ContainerRestart(ctx, p.ID, client.ContainerRestartOptions{Timeout: &timeout}); err != nil {
			return nil, &RPCError{Code: -32000, Message: err.Error()}
		}
		return map[string]string{"status": "restarted"}, nil

	case "container.remove":
		var p struct {
			ID    string `json:"id"`
			Force bool   `json:"force"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil || p.ID == "" {
			return nil, &RPCError{Code: -32602, Message: "container id required"}
		}
		if _, err := c.mobyCli.ContainerRemove(ctx, p.ID, client.ContainerRemoveOptions{Force: p.Force}); err != nil {
			return nil, &RPCError{Code: -32000, Message: err.Error()}
		}
		return map[string]string{"status": "removed"}, nil

	case "container.inspect":
		var p struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil || p.ID == "" {
			return nil, &RPCError{Code: -32602, Message: "container id required"}
		}
		res, err := c.mobyCli.ContainerInspect(ctx, p.ID, client.ContainerInspectOptions{})
		if err != nil {
			return nil, &RPCError{Code: -32000, Message: err.Error()}
		}
		return res, nil

	case "image.list":
		images, err := c.mobyCli.ImageList(ctx, client.ImageListOptions{})
		if err != nil {
			return nil, &RPCError{Code: -32000, Message: err.Error()}
		}
		return images.Items, nil

	default:
		return nil, &RPCError{Code: -32601, Message: fmt.Sprintf("method not found: %s", req.Method)}
	}
}

// writeFrame thread-safely encodes and transmits a binary frame
func (c *AgentClient) writeFrame(f Frame) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()

	if c.conn == nil {
		return errors.New("websocket connection is not open")
	}

	data := EncodeFrame(f)
	return c.conn.WriteMessage(websocket.BinaryMessage, data)
}

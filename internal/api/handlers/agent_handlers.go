package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
	"github.com/pilotworks/dockor/internal/agent"
	"github.com/pilotworks/dockor/internal/crypto"
	"github.com/pilotworks/dockor/internal/models"
)

// GenerateNodeEnrollment creates a unique enrollment token and returns join commands
func (h *APIHandler) GenerateNodeEnrollment(w http.ResponseWriter, r *http.Request) {
	bytes := make([]byte, 16)
	_, _ = rand.Read(bytes)
	token := "dck_enroll_" + hex.EncodeToString(bytes)

	// Persist enrollment token with 24-hour expiration
	if err := h.repo.CreateEnrollmentToken(r.Context(), token, 24*time.Hour); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to persist enrollment token: "+err.Error())
		return
	}

	host := r.Host
	if host == "" {
		host = "localhost:9000"
	}
	wsProto := "ws"
	httpProto := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		wsProto = "wss"
		httpProto = "https"
	}

	serverURL := fmt.Sprintf("%s://%s", httpProto, host)
	wsServerURL := fmt.Sprintf("%s://%s", wsProto, host)

	dockerCmd := fmt.Sprintf("docker run -d --name dockor-agent --restart unless-stopped -v /var/run/docker.sock:/var/run/docker.sock pilotworks/dockor-agent:latest --server %s --token %s", serverURL, token)
	installCmd := fmt.Sprintf("curl -fsSL %s/agent.sh | sudo sh -s -- --token %s --server %s", serverURL, token, serverURL)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"token":           token,
		"server_url":      serverURL,
		"ws_server_url":   wsServerURL,
		"docker_command":  dockerCmd,
		"install_command": installCmd,
	})
}

// AgentHandshake authenticates dockor-agent and registers node metadata
func (h *APIHandler) AgentHandshake(w http.ResponseWriter, r *http.Request) {
	var req agent.HandshakeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid handshake payload: "+err.Error())
		return
	}

	if req.EnrollmentToken == "" {
		writeError(w, http.StatusUnauthorized, "Enrollment token is required")
		return
	}

	// Validate enrollment token
	valid, err := h.repo.ValidateAndConsumeEnrollmentToken(r.Context(), req.EnrollmentToken)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Token validation error: "+err.Error())
		return
	}
	if !valid {
		writeError(w, http.StatusUnauthorized, "Invalid, expired, or already-consumed enrollment token")
		return
	}

	// Generate node ID and friendly name
	nodeBytes := make([]byte, 8)
	_, _ = rand.Read(nodeBytes)
	nodeID := "node_" + hex.EncodeToString(nodeBytes)

	nodeName := req.FriendlyName
	if nodeName == "" {
		if req.Hostname != "" {
			nodeName = fmt.Sprintf("Node (%s)", req.Hostname)
		} else {
			nodeName = "Remote Node " + nodeID[5:9]
		}
	}

	ipAddr := req.IPAddress
	if ipAddr == "" {
		ipAddr = r.RemoteAddr
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			ipAddr = strings.TrimSpace(strings.Split(xff, ",")[0])
		}
		// Strip port if present
		if colon := strings.LastIndex(ipAddr, ":"); colon != -1 {
			ipAddr = ipAddr[:colon]
		}
	}

	// Upsert node record in SQLite store
	node := &models.Node{
		ID:            nodeID,
		Name:          nodeName,
		Hostname:      req.Hostname,
		IPAddress:     ipAddr,
		DockerVersion: req.DockerVersion,
		Status:        models.NodeStatusOnline,
		IsLocal:       false,
		CPUCores:      req.CPUCores,
		TotalMemory:   req.TotalMemoryBytes,
		AgentVersion:  req.AgentVersion,
		OS:            req.OS,
		Arch:          req.Arch,
		Endpoint:      "agent://reverse-tunnel",
	}

	if err := h.repo.UpsertRemoteNode(r.Context(), node); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to register node: "+err.Error())
		return
	}

	// Generate long-lived JWT session token for the reverse tunnel
	claims := crypto.JWTClaims{
		Subject:   nodeID,
		Role:      "agent",
		ExpiresAt: time.Now().UTC().Add(90 * 24 * time.Hour).Unix(),
	}
	sessionToken, err := crypto.GenerateJWT(claims, h.jwtSecret)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to generate session credentials: "+err.Error())
		return
	}

	log.Printf("[AgentHandshake] Remote node enrolled: %s (%s) from %s", nodeID, nodeName, ipAddr)

	writeJSON(w, http.StatusOK, agent.HandshakeResponse{
		NodeID:               nodeID,
		SessionToken:         sessionToken,
		TunnelEndpoint:       "/api/v1/agent/tunnel",
		HeartbeatIntervalSec: agent.DefaultHeartbeatSec,
	})
}

// AgentTunnel upgrades the HTTP connection to a multiplexed WebSocket reverse tunnel
func (h *APIHandler) AgentTunnel(w http.ResponseWriter, r *http.Request) {
	// 1. Authenticate agent via query parameter or Authorization header
	token := r.URL.Query().Get("token")
	if token == "" {
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			token = strings.TrimPrefix(authHeader, "Bearer ")
		}
	}

	if token == "" {
		writeError(w, http.StatusUnauthorized, "Missing session token")
		return
	}

	claims, err := crypto.ValidateJWT(token, h.jwtSecret)
	if err != nil || claims.Role != "agent" || claims.Subject == "" {
		writeError(w, http.StatusUnauthorized, "Invalid or unauthorized session token")
		return
	}

	nodeID := claims.Subject

	// 2. Upgrade to WebSocket
	conn, err := wsUpgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[AgentTunnel] Upgrade failed for node %s: %v", nodeID, err)
		return
	}
	defer conn.Close()

	if h.agentHub == nil {
		_ = conn.WriteMessage(websocket.TextMessage, []byte("Agent hub not initialized on master"))
		return
	}

	// 3. Register active session in AgentHub
	session := h.agentHub.Register(nodeID, conn)
	defer h.agentHub.Unregister(nodeID)

	_ = h.repo.UpdateNodeStatus(r.Context(), nodeID, models.NodeStatusOnline)

	// Configure keep-alive ping handler
	conn.SetReadLimit(16 * 1024 * 1024) // 16MB maximum frame size
	_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	// 4. Inbound Frame Processing Loop
	for {
		msgType, data, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[AgentTunnel] Connection closed for node %s: %v", nodeID, err)
			}
			break
		}

		_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))

		if msgType == websocket.BinaryMessage {
			if err := h.agentHub.HandleIncomingMessage(r.Context(), session, data); err != nil {
				log.Printf("[AgentTunnel] Frame processing error for node %s: %v", nodeID, err)
			}
		}
	}
}

// PingNode tests connectivity and round-trip latency to a local or remote node
func (h *APIHandler) PingNode(w http.ResponseWriter, r *http.Request) {
	nodeID := chi.URLParam(r, "id")
	if nodeID == "" {
		writeError(w, http.StatusBadRequest, "Node ID is required")
		return
	}

	// Local node ping
	if nodeID == "node_local" {
		start := time.Now()
		if h.dockerSvc == nil {
			writeError(w, http.StatusServiceUnavailable, "Docker service not initialized")
			return
		}
		if err := h.dockerSvc.Ping(r.Context()); err != nil {
			writeError(w, http.StatusBadGateway, "Local Docker ping failed: "+err.Error())
			return
		}
		latency := time.Since(start).Milliseconds()
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"pong":       true,
			"node_id":    nodeID,
			"is_local":   true,
			"latency_ms": latency,
		})
		return
	}

	// Remote node ping via AgentHub RPC
	if h.agentHub == nil || !h.agentHub.IsNodeConnected(nodeID) {
		writeError(w, http.StatusBadGateway, fmt.Sprintf("Node %s is offline or disconnected", nodeID))
		return
	}

	start := time.Now()
	res, err := h.agentHub.SendRPC(r.Context(), nodeID, "ping", nil)
	if err != nil {
		writeError(w, http.StatusGatewayTimeout, "Ping RPC failed: "+err.Error())
		return
	}
	latency := time.Since(start).Milliseconds()

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"pong":       true,
		"node_id":    nodeID,
		"is_local":   false,
		"latency_ms": latency,
		"details":    res,
	})
}

// ServeAgentInstallScript serves the dynamic bash script for one-line agent setup
func (h *APIHandler) ServeAgentInstallScript(w http.ResponseWriter, r *http.Request) {
	script := `#!/bin/sh
set -e

# Dockor Remote Node Agent Bootstrap Script
echo "=================================================="
echo "          Installing Dockor Agent                 "
echo "=================================================="

SERVER_URL=""
TOKEN=""

while [ $# -gt 0 ]; do
    case "$1" in
        --server)
            SERVER_URL="$2"
            shift 2
            ;;
        --token)
            TOKEN="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

if [ -z "$SERVER_URL" ] || [ -z "$TOKEN" ]; then
    echo "Error: --server and --token flags are required."
    echo "Example: curl -fsSL <url>/agent.sh | sudo sh -s -- --server <url> --token <token>"
    exit 1
fi

# Detect architecture
ARCH=$(uname -m)
case "$ARCH" in
    x86_64)  ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

OS=$(uname -s | tr '[:upper:]' '[:lower:]')
if [ "$OS" != "linux" ] && [ "$OS" != "darwin" ]; then
    echo "Unsupported OS: $OS"
    exit 1
fi

# Ensure docker is accessible
if ! command -v docker >/dev/null 2>&1; then
    echo "Warning: docker command not found in PATH."
fi

# Check if running via Docker is preferred
if [ -S /var/run/docker.sock ]; then
    echo "Docker socket detected at /var/run/docker.sock"
    echo "Starting dockor-agent container..."
    docker rm -f dockor-agent 2>/dev/null || true
    docker run -d \
        --name dockor-agent \
        --restart unless-stopped \
        -v /var/run/docker.sock:/var/run/docker.sock \
        pilotworks/dockor-agent:latest \
        --server "$SERVER_URL" \
        --token "$TOKEN"
    echo "Dockor Agent container started successfully!"
    exit 0
fi

echo "Installing binary mode directly not yet implemented in script fallback."
`
	w.Header().Set("Content-Type", "text/x-shellscript; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(script))
}

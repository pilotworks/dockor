package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/pilotworks/dockor/internal/models"
)

// NodeRepository defines the repository operations required by the AgentHub
type NodeRepository interface {
	UpdateNodeStatus(ctx context.Context, id string, status models.NodeStatus) error
	UpdateNodeTelemetry(ctx context.Context, id string, cpuPercent float64, memUsed int64, running int, total int, dockerVer string) error
	MarkDisconnectedNodes(ctx context.Context, timeout time.Duration) (int64, error)
}

// AgentHub manages all connected remote agent sessions and orchestrates RPC dispatching
type AgentHub struct {
	repo       NodeRepository
	sessions   map[string]*AgentSession
	sessionsMu sync.RWMutex
}

// NewAgentHub creates a new AgentHub instance
func NewAgentHub(repo NodeRepository) *AgentHub {
	return &AgentHub{
		repo:     repo,
		sessions: make(map[string]*AgentSession),
	}
}

// Register adds or replaces an active agent session
func (h *AgentHub) Register(nodeID string, conn *websocket.Conn) *AgentSession {
	h.sessionsMu.Lock()
	defer h.sessionsMu.Unlock()

	// Close any prior session for this node ID
	if existing, found := h.sessions[nodeID]; found {
		_ = existing.Close()
	}

	session := NewAgentSession(nodeID, conn)
	h.sessions[nodeID] = session
	log.Printf("[AgentHub] Node %s registered and tunnel established", nodeID)
	return session
}

// Unregister cleanly removes an agent session
func (h *AgentHub) Unregister(nodeID string) {
	h.sessionsMu.Lock()
	session, found := h.sessions[nodeID]
	if found {
		delete(h.sessions, nodeID)
	}
	h.sessionsMu.Unlock()

	if found && session != nil {
		_ = session.Close()
		log.Printf("[AgentHub] Node %s unregistered", nodeID)
		if h.repo != nil {
			_ = h.repo.UpdateNodeStatus(context.Background(), nodeID, models.NodeStatusDisconnected)
		}
	}
}

// GetSession retrieves an active session for a given node ID
func (h *AgentHub) GetSession(nodeID string) (*AgentSession, bool) {
	h.sessionsMu.RLock()
	defer h.sessionsMu.RUnlock()
	session, found := h.sessions[nodeID]
	return session, found && !session.IsClosed()
}

// IsNodeConnected checks if the node is currently connected via active tunnel
func (h *AgentHub) IsNodeConnected(nodeID string) bool {
	_, connected := h.GetSession(nodeID)
	return connected
}

// ConnectedNodes returns a list of all currently connected node IDs
func (h *AgentHub) ConnectedNodes() []string {
	h.sessionsMu.RLock()
	defer h.sessionsMu.RUnlock()

	nodes := make([]string, 0, len(h.sessions))
	for id, s := range h.sessions {
		if !s.IsClosed() {
			nodes = append(nodes, id)
		}
	}
	return nodes
}

// SendRPC sends a JSON-RPC 2.0 request to the remote agent and waits synchronously for its result
func (h *AgentHub) SendRPC(ctx context.Context, nodeID string, method string, params interface{}) (json.RawMessage, error) {
	session, ok := h.GetSession(nodeID)
	if !ok {
		return nil, fmt.Errorf("remote node %s is offline or not connected", nodeID)
	}

	var paramsRaw json.RawMessage
	if params != nil {
		b, err := json.Marshal(params)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal rpc params: %w", err)
		}
		paramsRaw = b
	}

	reqID := "req-" + uuid.New().String()
	rpcReq := RPCRequest{
		JSONRPC: "2.0",
		ID:      reqID,
		Method:  method,
		Params:  paramsRaw,
	}

	reqBytes, err := json.Marshal(rpcReq)
	if err != nil {
		return nil, fmt.Errorf("failed to encode rpc request: %w", err)
	}

	respChan := make(chan *RPCResponse, 1)
	session.RegisterRPC(reqID, respChan)
	defer session.UnregisterRPC(reqID)

	streamID := session.NextStreamID()
	frame := Frame{
		Version:    ProtocolVersion,
		StreamType: StreamTypeControl,
		Flags:      0,
		StreamID:   streamID,
		Payload:    reqBytes,
	}

	if err := session.WriteFrame(frame); err != nil {
		return nil, fmt.Errorf("failed to write rpc frame to agent: %w", err)
	}

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-session.closeChan:
		return nil, errors.New("agent connection terminated during request")
	case resp := <-respChan:
		if resp == nil {
			return nil, errors.New("nil rpc response received")
		}
		if resp.Error != nil {
			return nil, resp.Error
		}
		return resp.Result, nil
	}
}

// HandleIncomingMessage parses and dispatches an incoming binary frame from the agent
func (h *AgentHub) HandleIncomingMessage(ctx context.Context, session *AgentSession, data []byte) error {
	frame, err := DecodeFrame(data)
	if err != nil {
		return fmt.Errorf("invalid binary frame: %w", err)
	}

	session.UpdateLastSeen()

	switch frame.StreamType {
	case StreamTypeTelemetry:
		var tel TelemetryPayload
		if err := json.Unmarshal(frame.Payload, &tel); err != nil {
			return fmt.Errorf("failed to parse telemetry payload: %w", err)
		}

		if h.repo != nil {
			_ = h.repo.UpdateNodeTelemetry(
				ctx,
				session.NodeID,
				tel.CPUPercent,
				tel.MemoryUsedBytes,
				tel.ContainersRunning,
				tel.ContainersTotal,
				tel.DockerVersion,
			)
		}
		return nil

	case StreamTypeControl:
		var rpcResp RPCResponse
		if err := json.Unmarshal(frame.Payload, &rpcResp); err != nil {
			return fmt.Errorf("failed to parse control rpc response: %w", err)
		}

		session.ResolveRPC(&rpcResp)
		return nil

	case StreamTypeLogs, StreamTypeExec:
		// Stream forwarding handled by stream multiplexer
		return nil

	default:
		return fmt.Errorf("unsupported stream type 0x%02x", frame.StreamType)
	}
}

// StartLivenessChecker starts a background task checking for dead peers
func (h *AgentHub) StartLivenessChecker(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	go func() {
		defer ticker.Stop()
		timeout := time.Duration(DisconnectTimeoutSec) * time.Second

		for {
			select {
			case <-ctx.Done():
				return
			case now := <-ticker.C:
				// 1. Check in-memory active sessions
				h.sessionsMu.Lock()
				for id, session := range h.sessions {
					if now.Sub(session.LastSeenTime()) > timeout {
						log.Printf("[AgentHub] Peer %s timed out after %v, disconnecting", id, timeout)
						_ = session.Close()
						delete(h.sessions, id)
						if h.repo != nil {
							_ = h.repo.UpdateNodeStatus(ctx, id, models.NodeStatusDisconnected)
						}
					}
				}
				h.sessionsMu.Unlock()

				// 2. Mark any DB records that missed heartbeats
				if h.repo != nil {
					_, _ = h.repo.MarkDisconnectedNodes(ctx, timeout)
				}
			}
		}
	}()
}

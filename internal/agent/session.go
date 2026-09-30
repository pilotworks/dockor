package agent

import (
	"errors"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

// AgentSession manages the state and I/O for a connected remote node
type AgentSession struct {
	NodeID       string
	Conn         *websocket.Conn
	writeMu      sync.Mutex
	pendingMu    sync.Mutex
	pendingRPCs  map[string]chan *RPCResponse
	streamSeq    uint32
	lastSeen     atomic.Int64 // Unix timestamp in nanoseconds
	isClosed     bool
	closedMu     sync.RWMutex
	closeChan    chan struct{}
}

// NewAgentSession creates an active agent session
func NewAgentSession(nodeID string, conn *websocket.Conn) *AgentSession {
	s := &AgentSession{
		NodeID:      nodeID,
		Conn:        conn,
		pendingRPCs: make(map[string]chan *RPCResponse),
		closeChan:   make(chan struct{}),
	}
	s.lastSeen.Store(time.Now().UnixNano())
	return s
}

// UpdateLastSeen records the timestamp of the latest frame received
func (s *AgentSession) UpdateLastSeen() {
	s.lastSeen.Store(time.Now().UnixNano())
}

// LastSeenTime returns the time of the latest received frame
func (s *AgentSession) LastSeenTime() time.Time {
	return time.Unix(0, s.lastSeen.Load())
}

// NextStreamID generates a monotonically increasing stream identifier
func (s *AgentSession) NextStreamID() uint32 {
	return atomic.AddUint32(&s.streamSeq, 1)
}

// WriteFrame transmits an encoded binary frame to the agent WebSocket
func (s *AgentSession) WriteFrame(f Frame) error {
	s.closedMu.RLock()
	if s.isClosed {
		s.closedMu.RUnlock()
		return errors.New("agent session is closed")
	}
	s.closedMu.RUnlock()

	s.writeMu.Lock()
	defer s.writeMu.Unlock()

	data := EncodeFrame(f)
	if s.Conn == nil {
		return errors.New("underlying connection is nil")
	}
	return s.Conn.WriteMessage(websocket.BinaryMessage, data)
}

// RegisterRPC registers a response channel for a given RPC request ID
func (s *AgentSession) RegisterRPC(id string, ch chan *RPCResponse) {
	s.pendingMu.Lock()
	defer s.pendingMu.Unlock()
	s.pendingRPCs[id] = ch
}

// UnregisterRPC removes a response channel for an RPC request ID
func (s *AgentSession) UnregisterRPC(id string) {
	s.pendingMu.Lock()
	defer s.pendingMu.Unlock()
	delete(s.pendingRPCs, id)
}

// ResolveRPC routes an RPC response to the matching caller
func (s *AgentSession) ResolveRPC(resp *RPCResponse) bool {
	s.pendingMu.Lock()
	ch, exists := s.pendingRPCs[resp.ID]
	if exists {
		delete(s.pendingRPCs, resp.ID)
	}
	s.pendingMu.Unlock()

	if exists && ch != nil {
		select {
		case ch <- resp:
			return true
		default:
			return false
		}
	}
	return false
}

// Close gracefully terminates the session and aborts pending RPC calls
func (s *AgentSession) Close() error {
	s.closedMu.Lock()
	if s.isClosed {
		s.closedMu.Unlock()
		return nil
	}
	s.isClosed = true
	close(s.closeChan)
	s.closedMu.Unlock()

	// Drain and reject all pending RPCs
	s.pendingMu.Lock()
	for id, ch := range s.pendingRPCs {
		select {
		case ch <- &RPCResponse{
			ID:    id,
			Error: &RPCError{Code: -32000, Message: "session closed unexpectedly"},
		}:
		default:
		}
	}
	s.pendingRPCs = make(map[string]chan *RPCResponse)
	s.pendingMu.Unlock()

	if s.Conn != nil {
		return s.Conn.Close()
	}
	return nil
}

// IsClosed checks if session is terminated
func (s *AgentSession) IsClosed() bool {
	s.closedMu.RLock()
	defer s.closedMu.RUnlock()
	return s.isClosed
}

package agent

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
)

const (
	// ProtocolVersion defines the current binary wire protocol version
	ProtocolVersion uint8 = 0x01

	// HeaderSize defines the binary frame header size in bytes
	HeaderSize int = 8

	// Stream types
	StreamTypeControl   uint8 = 0x01 // RPC JSON-RPC 2.0 messages
	StreamTypeTelemetry uint8 = 0x02 // Node resource & container telemetry
	StreamTypeLogs      uint8 = 0x03 // Container stdout/stderr log streams
	StreamTypeExec      uint8 = 0x04 // Interactive PTY terminal stream

	// Flags
	FlagSYN uint16 = 0x0001 // Open stream
	FlagFIN uint16 = 0x0002 // Close stream
	FlagRST uint16 = 0x0004 // Abort/reset stream

	// DefaultHeartbeatSec defines the default interval between heartbeats
	DefaultHeartbeatSec int = 5

	// DisconnectTimeoutSec defines the time after which a silent node is marked disconnected
	DisconnectTimeoutSec int = 15
)

// Frame represents a single multiplexed binary frame over WebSocket tunnel
type Frame struct {
	Version    uint8
	StreamType uint8
	Flags      uint16
	StreamID   uint32
	Payload    []byte
}

// EncodeFrame serializes a Frame into a byte slice with the 8-byte header
func EncodeFrame(f Frame) []byte {
	version := f.Version
	if version == 0 {
		version = ProtocolVersion
	}
	buf := make([]byte, HeaderSize+len(f.Payload))
	buf[0] = version
	buf[1] = f.StreamType
	binary.BigEndian.PutUint16(buf[2:4], f.Flags)
	binary.BigEndian.PutUint32(buf[4:8], f.StreamID)
	copy(buf[HeaderSize:], f.Payload)
	return buf
}

// DecodeFrame deserializes an 8-byte header and payload into a Frame
func DecodeFrame(data []byte) (*Frame, error) {
	if len(data) < HeaderSize {
		return nil, errors.New("frame data too short for 8-byte binary header")
	}

	return &Frame{
		Version:    data[0],
		StreamType: data[1],
		Flags:      binary.BigEndian.Uint16(data[2:4]),
		StreamID:   binary.BigEndian.Uint32(data[4:8]),
		Payload:    data[HeaderSize:],
	}, nil
}

// HandshakeRequest represents an enrollment/registration request from dockor-agent
type HandshakeRequest struct {
	EnrollmentToken  string `json:"enrollment_token"`
	Hostname         string `json:"hostname"`
	FriendlyName     string `json:"friendly_name,omitempty"`
	AgentVersion     string `json:"agent_version"`
	OS               string `json:"os"`
	Arch             string `json:"arch"`
	DockerVersion    string `json:"docker_version"`
	TotalMemoryBytes int64  `json:"total_memory_bytes"`
	CPUCores         int    `json:"cpu_cores"`
	IPAddress        string `json:"ip_address,omitempty"`
}

// HandshakeResponse represents the server's response to an agent handshake
type HandshakeResponse struct {
	NodeID               string `json:"node_id"`
	SessionToken         string `json:"session_token"`
	TunnelEndpoint       string `json:"tunnel_endpoint"`
	HeartbeatIntervalSec int    `json:"heartbeat_interval_sec"`
}

// TelemetryPayload represents resource telemetry emitted periodically by the agent
type TelemetryPayload struct {
	CPUPercent        float64 `json:"cpu_percent"`
	MemoryUsedBytes   int64   `json:"memory_used_bytes"`
	MemoryTotalBytes  int64   `json:"memory_total_bytes"`
	ContainersRunning int     `json:"containers_running"`
	ContainersPaused  int     `json:"containers_paused"`
	ContainersStopped int     `json:"containers_stopped"`
	ContainersTotal   int     `json:"containers_total"`
	ImagesCount       int     `json:"images_count"`
	DockerVersion     string  `json:"docker_version"`
	Timestamp         int64   `json:"timestamp"`
}

// RPCRequest represents a JSON-RPC 2.0 command sent across StreamTypeControl
type RPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      string          `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

// RPCResponse represents a JSON-RPC 2.0 response
type RPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      string          `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *RPCError       `json:"error,omitempty"`
}

// RPCError represents standard JSON-RPC 2.0 error structure
type RPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (e *RPCError) Error() string {
	return fmt.Sprintf("rpc error %d: %s", e.Code, e.Message)
}

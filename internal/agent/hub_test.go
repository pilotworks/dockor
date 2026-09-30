package agent

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/pilotworks/dockor/internal/models"
)

type mockNodeRepo struct {
	mu           sync.Mutex
	statusMap    map[string]models.NodeStatus
	telemetryMap map[string]TelemetryPayload
}

func newMockRepo() *mockNodeRepo {
	return &mockNodeRepo{
		statusMap:    make(map[string]models.NodeStatus),
		telemetryMap: make(map[string]TelemetryPayload),
	}
}

func (m *mockNodeRepo) UpdateNodeStatus(ctx context.Context, id string, status models.NodeStatus) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.statusMap[id] = status
	return nil
}

func (m *mockNodeRepo) UpdateNodeTelemetry(ctx context.Context, id string, cpuPercent float64, memUsed int64, running int, total int, dockerVer string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.telemetryMap[id] = TelemetryPayload{
		CPUPercent:        cpuPercent,
		MemoryUsedBytes:   memUsed,
		ContainersRunning: running,
		ContainersTotal:   total,
		DockerVersion:     dockerVer,
	}
	return nil
}

func (m *mockNodeRepo) MarkDisconnectedNodes(ctx context.Context, timeout time.Duration) (int64, error) {
	return 0, nil
}

func TestAgentHubSessionAndTelemetry(t *testing.T) {
	repo := newMockRepo()
	hub := NewAgentHub(repo)

	session := hub.Register("node-test-1", nil)
	if !hub.IsNodeConnected("node-test-1") {
		t.Fatal("expected node to be connected")
	}

	// Test Telemetry message parsing
	telPayload := TelemetryPayload{
		CPUPercent:        25.5,
		MemoryUsedBytes:   1024 * 1024 * 512,
		ContainersRunning: 3,
		ContainersTotal:   5,
		DockerVersion:     "26.1.1",
	}
	telBytes, _ := json.Marshal(telPayload)
	frame := Frame{
		Version:    ProtocolVersion,
		StreamType: StreamTypeTelemetry,
		Payload:    telBytes,
	}
	encoded := EncodeFrame(frame)

	ctx := context.Background()
	if err := hub.HandleIncomingMessage(ctx, session, encoded); err != nil {
		t.Fatalf("failed to handle telemetry: %v", err)
	}

	repo.mu.Lock()
	tel := repo.telemetryMap["node-test-1"]
	repo.mu.Unlock()

	if tel.CPUPercent != 25.5 || tel.ContainersRunning != 3 {
		t.Errorf("telemetry not recorded accurately: %+v", tel)
	}

	// Test Unregister
	hub.Unregister("node-test-1")
	if hub.IsNodeConnected("node-test-1") {
		t.Fatal("expected node to be disconnected after unregister")
	}
}

func TestAgentHubRPCResolution(t *testing.T) {
	repo := newMockRepo()
	hub := NewAgentHub(repo)

	session := hub.Register("node-rpc-test", nil)

	// Simulate RPC response resolving
	reqID := "req-mock-123"
	respChan := make(chan *RPCResponse, 1)
	session.RegisterRPC(reqID, respChan)

	rpcResp := RPCResponse{
		JSONRPC: "2.0",
		ID:      reqID,
		Result:  json.RawMessage(`{"pong":true}`),
	}
	respBytes, _ := json.Marshal(rpcResp)
	frame := Frame{
		Version:    ProtocolVersion,
		StreamType: StreamTypeControl,
		Payload:    respBytes,
	}

	ctx := context.Background()
	if err := hub.HandleIncomingMessage(ctx, session, EncodeFrame(frame)); err != nil {
		t.Fatalf("failed to handle RPC response: %v", err)
	}

	select {
	case res := <-respChan:
		if res.ID != reqID || string(res.Result) != `{"pong":true}` {
			t.Errorf("unexpected rpc result: %+v", res)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("timeout waiting for rpc resolution")
	}
}

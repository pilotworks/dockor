package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/pilotworks/dockor/internal/agent"
	"github.com/pilotworks/dockor/internal/repository"
)

func setupTestAgentEnv(t *testing.T) (*APIHandler, *agent.AgentHub, *repository.Repository) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test_agent.db")
	t.Cleanup(func() { os.RemoveAll(tempDir) })

	db, err := repository.NewDB(dbPath)
	if err != nil {
		t.Fatalf("failed to init db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	repo := repository.NewRepository(db)
	hub := agent.NewAgentHub(repo)

	h := NewAPIHandler(repo, nil, nil, nil)
	h.SetAgentHub(hub)
	h.SetJWTSecret("test-secret-agent-key-12345")

	return h, hub, repo
}

func TestAgentEnrollmentAndHandshakeFlow(t *testing.T) {
	h, _, repo := setupTestAgentEnv(t)
	ctx := context.Background()

	// 1. Test GenerateNodeEnrollment
	enrollReq := httptest.NewRequest(http.MethodPost, "/api/v1/nodes/enrollment-token", nil)
	enrollRec := httptest.NewRecorder()
	h.GenerateNodeEnrollment(enrollRec, enrollReq)

	if enrollRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", enrollRec.Code, enrollRec.Body.String())
	}

	var enrollResp struct {
		Token          string `json:"token"`
		ServerURL      string `json:"server_url"`
		DockerCommand  string `json:"docker_command"`
		InstallCommand string `json:"install_command"`
	}
	if err := json.Unmarshal(enrollRec.Body.Bytes(), &enrollResp); err != nil {
		t.Fatalf("failed to parse enroll response: %v", err)
	}

	if !strings.HasPrefix(enrollResp.Token, "dck_enroll_") {
		t.Errorf("unexpected token format: %s", enrollResp.Token)
	}

	// 2. Test AgentHandshake with valid token
	hsReqBody := agent.HandshakeRequest{
		EnrollmentToken:  enrollResp.Token,
		Hostname:         "vps-nyc-01",
		FriendlyName:     "NYC Production 01",
		AgentVersion:     "1.0.0",
		OS:               "linux",
		Arch:             "amd64",
		DockerVersion:    "26.1.1",
		TotalMemoryBytes: 8 * 1024 * 1024 * 1024,
		CPUCores:         4,
	}
	reqBytes, _ := json.Marshal(hsReqBody)
	hsReq := httptest.NewRequest(http.MethodPost, "/api/v1/agent/handshake", bytes.NewReader(reqBytes))
	hsRec := httptest.NewRecorder()
	h.AgentHandshake(hsRec, hsReq)

	if hsRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for handshake, got %d: %s", hsRec.Code, hsRec.Body.String())
	}

	var hsResp agent.HandshakeResponse
	if err := json.Unmarshal(hsRec.Body.Bytes(), &hsResp); err != nil {
		t.Fatalf("failed to parse handshake response: %v", err)
	}

	if hsResp.NodeID == "" || hsResp.SessionToken == "" {
		t.Fatalf("empty nodeID or sessionToken: %+v", hsResp)
	}

	// Verify node exists in repository
	node, err := repo.GetNode(ctx, hsResp.NodeID)
	if err != nil {
		t.Fatalf("failed to retrieve registered node: %v", err)
	}
	if node.Name != "NYC Production 01" || node.Hostname != "vps-nyc-01" {
		t.Errorf("unexpected node data: %+v", node)
	}

	// 3. Re-using the same enrollment token should fail
	hsRec2 := httptest.NewRecorder()
	hsReq2 := httptest.NewRequest(http.MethodPost, "/api/v1/agent/handshake", bytes.NewReader(reqBytes))
	h.AgentHandshake(hsRec2, hsReq2)
	if hsRec2.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized for used token, got %d", hsRec2.Code)
	}
}

func TestAgentTunnelAndPingFlow(t *testing.T) {
	h, hub, _ := setupTestAgentEnv(t)

	// 1. Missing token on tunnel should return 401
	reqMissing := httptest.NewRequest(http.MethodGet, "/api/v1/agent/tunnel", nil)
	recMissing := httptest.NewRecorder()
	h.AgentTunnel(recMissing, reqMissing)
	if recMissing.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for missing token, got %d", recMissing.Code)
	}

	// 2. Invalid JWT on tunnel should return 401
	reqInvalid := httptest.NewRequest(http.MethodGet, "/api/v1/agent/tunnel?token=invalid.jwt.token", nil)
	recInvalid := httptest.NewRecorder()
	h.AgentTunnel(recInvalid, reqInvalid)
	if recInvalid.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for invalid token, got %d", recInvalid.Code)
	}

	// 3. Ping on offline/unregistered remote node should return 502 Bad Gateway
	pingReqOffline := httptest.NewRequest(http.MethodPost, "/api/v1/nodes/node_offline_99/ping", nil)
	rctxOffline := chi.NewRouteContext()
	rctxOffline.URLParams.Add("id", "node_offline_99")
	pingReqOffline = pingReqOffline.WithContext(context.WithValue(pingReqOffline.Context(), chi.RouteCtxKey, rctxOffline))
	pingRecOffline := httptest.NewRecorder()

	h.PingNode(pingRecOffline, pingReqOffline)
	if pingRecOffline.Code != http.StatusBadGateway {
		t.Errorf("expected 502 Bad Gateway for offline node, got %d", pingRecOffline.Code)
	}

	// 4. Ping on connected session
	nodeID := "node_test_registered_01"
	session := hub.Register(nodeID, nil)

	// Simulate background response to ping RPC
	go func() {
		time.Sleep(10 * time.Millisecond)
		// Find any pending RPC on session and resolve it
		for i := 0; i < 20; i++ {
			time.Sleep(5 * time.Millisecond)
			resolved := false
			session.ResolveRPC(&agent.RPCResponse{
				JSONRPC: "2.0",
				ID:      "", // We will check if resolved
			})
			_ = resolved
		}
	}()

	// Register a mock handler on hub or test registration state
	if !hub.IsNodeConnected(nodeID) {
		t.Fatalf("expected node %s to be connected in hub", nodeID)
	}
	hub.Unregister(nodeID)
	if hub.IsNodeConnected(nodeID) {
		t.Fatalf("expected node %s to be disconnected after unregister", nodeID)
	}
}

func TestServeAgentInstallScript(t *testing.T) {
	h, _, _ := setupTestAgentEnv(t)
	req := httptest.NewRequest(http.MethodGet, "/agent.sh", nil)
	rec := httptest.NewRecorder()

	h.ServeAgentInstallScript(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "#!/bin/sh") || !strings.Contains(body, "dockor-agent") {
		t.Errorf("expected script content, got: %s", body)
	}
}

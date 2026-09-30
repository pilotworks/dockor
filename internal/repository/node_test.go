package repository

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/pilotworks/dockor/internal/models"
)

func TestNodeAndEnrollmentRepository(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test_node.db")
	defer os.RemoveAll(tempDir)

	db, err := NewDB(dbPath)
	if err != nil {
		t.Fatalf("failed to init db: %v", err)
	}
	defer db.Close()

	repo := NewRepository(db)
	ctx := context.Background()

	// 1. Test Enrollment Token
	token := "dck_enroll_test123"
	if err := repo.CreateEnrollmentToken(ctx, token, 10*time.Minute); err != nil {
		t.Fatalf("failed to create enrollment token: %v", err)
	}

	valid, err := repo.ValidateAndConsumeEnrollmentToken(ctx, token)
	if err != nil || !valid {
		t.Fatalf("expected valid token, got valid=%v, err=%v", valid, err)
	}

	// Consuming second time should fail
	valid2, err := repo.ValidateAndConsumeEnrollmentToken(ctx, token)
	if err != nil || valid2 {
		t.Fatalf("expected second consumption to fail, got valid=%v", valid2)
	}

	// 2. Test UpsertRemoteNode
	remoteNode := &models.Node{
		ID:            "node_remote_01",
		Name:          "Remote Server",
		Hostname:      "vps-01.internal",
		IPAddress:     "192.168.1.100",
		DockerVersion: "26.1.1",
		Status:        models.NodeStatusOnline,
		CPUCores:      4,
		TotalMemory:   8 * 1024 * 1024 * 1024,
		AgentVersion:  "1.0.0",
		OS:            "linux",
		Arch:          "amd64",
	}

	if err := repo.UpsertRemoteNode(ctx, remoteNode); err != nil {
		t.Fatalf("failed to upsert remote node: %v", err)
	}

	// 3. Test GetNode
	fetched, err := repo.GetNode(ctx, "node_remote_01")
	if err != nil {
		t.Fatalf("failed to get node: %v", err)
	}
	if fetched.Hostname != "vps-01.internal" || fetched.Status != models.NodeStatusOnline {
		t.Errorf("unexpected node properties: %+v", fetched)
	}

	// 4. Test UpdateNodeTelemetry
	if err := repo.UpdateNodeTelemetry(ctx, "node_remote_01", 34.5, 4*1024*1024*1024, 5, 8, "26.1.1"); err != nil {
		t.Fatalf("failed to update telemetry: %v", err)
	}

	fetched2, _ := repo.GetNode(ctx, "node_remote_01")
	if fetched2.CPUUsagePercent != 34.5 || fetched2.ContainersRunning != 5 {
		t.Errorf("unexpected telemetry on node: %+v", fetched2)
	}

	// 5. Test MarkDisconnectedNodes
	// Force last_seen_at in past
	past := time.Now().UTC().Add(-30 * time.Second)
	_, _ = db.ExecContext(ctx, "UPDATE nodes SET last_seen_at = ? WHERE id = ?", past, "node_remote_01")

	affected, err := repo.MarkDisconnectedNodes(ctx, 15*time.Second)
	if err != nil {
		t.Fatalf("failed to mark disconnected nodes: %v", err)
	}
	if affected != 1 {
		t.Errorf("expected 1 node marked disconnected, got %d", affected)
	}

	fetched3, _ := repo.GetNode(ctx, "node_remote_01")
	if fetched3.Status != models.NodeStatusDisconnected {
		t.Errorf("expected status disconnected, got %s", fetched3.Status)
	}
}

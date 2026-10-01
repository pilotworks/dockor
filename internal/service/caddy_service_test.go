package service

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/pilotworks/dockor/internal/models"
	"github.com/pilotworks/dockor/internal/repository"
)

func TestGenerateCaddyfile(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "dockor-caddy-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	db, err := repository.NewDB(filepath.Join(tempDir, "test.db"))
	if err != nil {
		t.Fatalf("failed to init db: %v", err)
	}
	defer db.Close()

	repo := repository.NewRepository(db)
	svc := NewCaddyService(repo, tempDir, "http://localhost:2019", "admin@dockor.local")

	routes := []models.ProxyRoute{
		{
			Domain:    "app.dockor.local",
			TargetURL: "http://localhost:8080",
			SSLMode:   models.SSLModeLetsEncrypt,
			Enabled:   true,
		},
		{
			Domain:    "internal.dockor.local",
			TargetURL: "127.0.0.1:3000",
			SSLMode:   models.SSLModeInternal,
			Enabled:   true,
		},
		{
			Domain:    "plain.dockor.local",
			TargetURL: "localhost:8000",
			SSLMode:   models.SSLModeDisabled,
			Enabled:   true,
		},
		{
			Domain:    "disabled.dockor.local",
			TargetURL: "localhost:9999",
			SSLMode:   models.SSLModeLetsEncrypt,
			Enabled:   false,
		},
	}

	caddyfile := svc.GenerateCaddyfile(routes)

	if !strings.Contains(caddyfile, "email admin@dockor.local") {
		t.Errorf("expected global email in caddyfile, got:\n%s", caddyfile)
	}
	if !strings.Contains(caddyfile, "app.dockor.local {") {
		t.Errorf("expected app.dockor.local block, got:\n%s", caddyfile)
	}
	if !strings.Contains(caddyfile, "reverse_proxy localhost:8080") {
		t.Errorf("expected reverse_proxy localhost:8080, got:\n%s", caddyfile)
	}
	if !strings.Contains(caddyfile, "internal.dockor.local {") || !strings.Contains(caddyfile, "tls internal") {
		t.Errorf("expected tls internal block for internal route, got:\n%s", caddyfile)
	}
	if !strings.Contains(caddyfile, "http://plain.dockor.local {") {
		t.Errorf("expected http://plain.dockor.local block for disabled SSL, got:\n%s", caddyfile)
	}
	if strings.Contains(caddyfile, "disabled.dockor.local") {
		t.Errorf("disabled route should not appear in caddyfile, got:\n%s", caddyfile)
	}
}

func TestCaddyServiceSyncAndStatus(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "dockor-caddy-sync-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	db, err := repository.NewDB(filepath.Join(tempDir, "test.db"))
	if err != nil {
		t.Fatalf("failed to init db: %v", err)
	}
	defer db.Close()

	repo := repository.NewRepository(db)
	ctx := context.Background()

	err = repo.CreateProxyRoute(ctx, &models.ProxyRoute{
		Domain:    "demo.example.com",
		TargetURL: "localhost:5000",
		SSLMode:   models.SSLModeLetsEncrypt,
		Enabled:   true,
	})
	if err != nil {
		t.Fatalf("failed to create route: %v", err)
	}

	svc := NewCaddyService(repo, tempDir, "http://127.0.0.1:20199", "") // non-running port for testing fallback

	// Sync should write to disk without error even when daemon is unavailable
	if err := svc.Sync(ctx); err != nil {
		t.Fatalf("expected sync to succeed with disk fallback: %v", err)
	}

	caddyfilePath := filepath.Join(tempDir, "caddy", "Caddyfile")
	data, err := os.ReadFile(caddyfilePath)
	if err != nil {
		t.Fatalf("expected Caddyfile on disk: %v", err)
	}
	if !strings.Contains(string(data), "demo.example.com") {
		t.Errorf("Caddyfile does not contain demo.example.com: %s", string(data))
	}

	status, err := svc.GetStatus(ctx)
	if err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}
	if status.ActiveRoutes != 1 {
		t.Errorf("expected 1 active route, got %d", status.ActiveRoutes)
	}
	if status.Running != false {
		t.Errorf("expected Running to be false for dummy port")
	}
}

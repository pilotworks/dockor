package service

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/pilotworks/dockor/internal/models"
)

func TestComposeService_PrepareStackFiles(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "dockor-compose-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	cs := NewComposeService("unix:///var/run/docker.sock", tempDir)

	stack := &models.Stack{
		ID:          "stk_test_123",
		Name:        "test-app",
		ComposeYAML: "version: '3.8'\nservices:\n  web:\n    image: nginx:alpine\n",
		EnvVars: map[string]string{
			"PORT":      "8080",
			"APP_TITLE": "Hello World",
		},
	}

	err = cs.PrepareStackFiles(stack)
	if err != nil {
		t.Fatalf("unexpected error preparing files: %v", err)
	}

	stackDir := cs.StackDir(stack.ID)

	// Check docker-compose.yml exists and matches
	composePath := filepath.Join(stackDir, "docker-compose.yml")
	content, err := os.ReadFile(composePath)
	if err != nil {
		t.Fatalf("failed to read compose file: %v", err)
	}
	if string(content) != stack.ComposeYAML {
		t.Errorf("expected compose yaml %q, got %q", stack.ComposeYAML, string(content))
	}

	// Check .env exists
	envPath := filepath.Join(stackDir, ".env")
	envContent, err := os.ReadFile(envPath)
	if err != nil {
		t.Fatalf("failed to read .env file: %v", err)
	}
	envStr := string(envContent)
	if !strings.Contains(envStr, "PORT=8080") {
		t.Errorf("expected PORT=8080 in .env, got %s", envStr)
	}
	if !strings.Contains(envStr, "APP_TITLE=\"Hello World\"") {
		t.Errorf("expected quoted APP_TITLE in .env, got %s", envStr)
	}

	// Test RemoveStackDir
	err = cs.RemoveStackDir(stack.ID)
	if err != nil {
		t.Fatalf("unexpected error removing stack dir: %v", err)
	}
	if _, err := os.Stat(stackDir); !os.IsNotExist(err) {
		t.Errorf("expected stack directory to be deleted, but it still exists")
	}
}

func TestComposeService_FindBinary(t *testing.T) {
	cs := NewComposeService("", "/tmp")
	bin, isPlugin, err := cs.findBinary()
	if err != nil {
		t.Logf("findBinary returned err: %v (might be expected if docker is not installed)", err)
		return
	}
	if bin == "" {
		t.Errorf("expected non-empty binary path")
	}
	t.Logf("found binary: %s (isPlugin: %v)", bin, isPlugin)
}

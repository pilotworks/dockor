package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/pilotworks/dockor/internal/models"
	"github.com/pilotworks/dockor/internal/repository"
	"github.com/pilotworks/dockor/internal/service"
)

func setupTestHandler(t *testing.T) (*APIHandler, *repository.Repository, string) {
	tempDir, err := os.MkdirTemp("", "dockor-api-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	dbPath := tempDir + "/test.db"
	db, err := repository.NewDB(dbPath)
	if err != nil {
		t.Fatalf("failed to create db: %v", err)
	}

	repo := repository.NewRepository(db)
	_ = repo.UpsertLocalNode(context.Background(), &models.Node{
		ID:        "node_local",
		Name:      "Local Engine",
		Hostname:  "localhost",
		IPAddress: "127.0.0.1",
		Status:    models.NodeStatusOnline,
		IsLocal:   true,
	})
	templateEng := service.NewTemplateEngine(tempDir + "/templates")
	composeSvc := service.NewComposeService("", tempDir)

	h := NewAPIHandler(repo, nil, templateEng, composeSvc)
	return h, repo, tempDir
}

func TestStackHandlers_CRUD(t *testing.T) {
	h, repo, tempDir := setupTestHandler(t)
	defer os.RemoveAll(tempDir)

	// 1. Deploy Stack (Raw compose without docker daemon - will attempt up and gracefully record)
	deployReq := DeployStackRequest{
		Name:        "my-test-stack",
		ComposeYAML: "version: '3.8'\nservices:\n  redis:\n    image: redis:alpine\n",
	}
	body, _ := json.Marshal(deployReq)
	req := httptest.NewRequest("POST", "/api/v1/stacks", bytes.NewReader(body))
	w := httptest.NewRecorder()

	h.DeployStack(w, req)
	// If docker is available, status might be 201; if docker daemon is unavailable in sandbox, it might return 500 with stack recorded
	res := w.Result()
	if res.StatusCode != http.StatusCreated && res.StatusCode != http.StatusInternalServerError {
		t.Fatalf("unexpected status code: %d", res.StatusCode)
	}

	// Verify stack was saved in repository
	stacks, err := repo.ListStacks(context.Background(), "")
	if err != nil {
		t.Fatalf("failed to list stacks: %v", err)
	}
	if len(stacks) != 1 {
		t.Fatalf("expected 1 stack in db, got %d", len(stacks))
	}
	stackID := stacks[0].ID

	// 2. Get Stack via Handler
	r := chi.NewRouter()
	r.Get("/api/v1/stacks/{id}", h.GetStack)

	getReq := httptest.NewRequest("GET", "/api/v1/stacks/"+stackID, nil)
	getRec := httptest.NewRecorder()
	r.ServeHTTP(getRec, getReq)

	if getRec.Result().StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK on GetStack, got %d", getRec.Result().StatusCode)
	}

	var fetched models.Stack
	_ = json.NewDecoder(getRec.Body).Decode(&fetched)
	if fetched.Name != "my-test-stack" {
		t.Errorf("expected stack name 'my-test-stack', got %s", fetched.Name)
	}

	// 2.5 Update Stack via Handler
	r.Put("/api/v1/stacks/{id}", h.UpdateStack)
	updatePayload, _ := json.Marshal(map[string]interface{}{
		"compose_yaml": "version: '3.8'\nservices:\n  redis:\n    image: redis:7-alpine\n",
		"redeploy":     false,
	})
	putReq := httptest.NewRequest("PUT", "/api/v1/stacks/"+stackID, bytes.NewReader(updatePayload))
	putRec := httptest.NewRecorder()
	r.ServeHTTP(putRec, putReq)

	if putRec.Result().StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK on UpdateStack, got %d", putRec.Result().StatusCode)
	}

	// Verify updated compose_yaml in repository
	updatedStack, _ := repo.GetStack(context.Background(), stackID)
	if updatedStack == nil || !bytes.Contains([]byte(updatedStack.ComposeYAML), []byte("redis:7-alpine")) {
		t.Errorf("expected updated compose yaml with redis:7-alpine, got %v", updatedStack)
	}

	// 3. Delete Stack via Handler
	r.Delete("/api/v1/stacks/{id}", h.DeleteStack)
	delReq := httptest.NewRequest("DELETE", "/api/v1/stacks/"+stackID, nil)
	delRec := httptest.NewRecorder()
	r.ServeHTTP(delRec, delReq)

	if delRec.Result().StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK on DeleteStack, got %d", delRec.Result().StatusCode)
	}

	// Verify stack was deleted
	stacksAfter, _ := repo.ListStacks(context.Background(), "")
	if len(stacksAfter) != 0 {
		t.Errorf("expected 0 stacks after delete, got %d", len(stacksAfter))
	}
}

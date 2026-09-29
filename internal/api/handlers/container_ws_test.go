package handlers

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/pilotworks/dockor/internal/repository"
	"github.com/pilotworks/dockor/internal/service"
)

func TestContainerLogs_NoDocker(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "dockor-ws-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	db, _ := repository.NewDB(tempDir + "/test.db")
	repo := repository.NewRepository(db)
	templateEng := service.NewTemplateEngine(tempDir + "/templates")
	composeSvc := service.NewComposeService("", tempDir)

	// dockerSvc is nil to test graceful degradation
	h := NewAPIHandler(repo, nil, templateEng, composeSvc)

	r := chi.NewRouter()
	r.Get("/api/v1/containers/{id}/logs", h.ContainerLogs)
	r.Get("/api/v1/containers/{id}/exec", h.ContainerExec)

	// Test Logs endpoint with nil dockerSvc
	req := httptest.NewRequest("GET", "/api/v1/containers/c_123/logs", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Result().StatusCode != http.StatusServiceUnavailable {
		t.Errorf("expected 503 Service Unavailable, got %d", rec.Result().StatusCode)
	}

	// Test Exec endpoint with nil dockerSvc
	reqExec := httptest.NewRequest("GET", "/api/v1/containers/c_123/exec", nil)
	recExec := httptest.NewRecorder()
	r.ServeHTTP(recExec, reqExec)

	if recExec.Result().StatusCode != http.StatusServiceUnavailable {
		t.Errorf("expected 503 Service Unavailable, got %d", recExec.Result().StatusCode)
	}
}

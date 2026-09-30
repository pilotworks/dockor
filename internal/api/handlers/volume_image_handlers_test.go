package handlers

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestVolumeHandlers_NoDockerService(t *testing.T) {
	h, _, tempDir := setupTestHandler(t)
	defer os.RemoveAll(tempDir)

	// ListVolumes without docker service -> 503
	req := httptest.NewRequest("GET", "/api/v1/volumes", nil)
	w := httptest.NewRecorder()
	h.ListVolumes(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", w.Code)
	}

	// CreateVolume without docker service -> 503
	body := []byte(`{"name":"test-vol","driver":"local"}`)
	req = httptest.NewRequest("POST", "/api/v1/volumes", bytes.NewReader(body))
	w = httptest.NewRecorder()
	h.CreateVolume(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", w.Code)
	}

	// PruneVolumes without docker service -> 503
	req = httptest.NewRequest("POST", "/api/v1/volumes/prune", nil)
	w = httptest.NewRecorder()
	h.PruneVolumes(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", w.Code)
	}
}

func TestImageHandlers_NoDockerService(t *testing.T) {
	h, _, tempDir := setupTestHandler(t)
	defer os.RemoveAll(tempDir)

	// ListImages without docker service -> 503
	req := httptest.NewRequest("GET", "/api/v1/images", nil)
	w := httptest.NewRecorder()
	h.ListImages(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", w.Code)
	}

	// PullImage without docker service -> 503
	body := []byte(`{"image":"alpine:latest"}`)
	req = httptest.NewRequest("POST", "/api/v1/images/pull", bytes.NewReader(body))
	w = httptest.NewRecorder()
	h.PullImage(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", w.Code)
	}

	// PruneImages without docker service -> 503
	req = httptest.NewRequest("POST", "/api/v1/images/prune", nil)
	w = httptest.NewRecorder()
	h.PruneImages(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", w.Code)
	}

	// GetImage without docker service -> 503
	req = httptest.NewRequest("GET", "/api/v1/images/sha256%3A12345", nil)
	w = httptest.NewRecorder()
	h.GetImage(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", w.Code)
	}

	// DeleteImage without docker service -> 503
	req = httptest.NewRequest("DELETE", "/api/v1/images/sha256%3A12345", nil)
	w = httptest.NewRecorder()
	h.DeleteImage(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", w.Code)
	}
}

func TestCreateContainerHandler_NoDockerService(t *testing.T) {
	h, _, tempDir := setupTestHandler(t)
	defer os.RemoveAll(tempDir)

	body := []byte(`{"image":"nginx:alpine","name":"test-web"}`)
	req := httptest.NewRequest("POST", "/api/v1/containers", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateContainer(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", w.Code)
	}
}


package handlers

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestNetworkHandlers_NoDockerService(t *testing.T) {
	h, _, tempDir := setupTestHandler(t)
	defer os.RemoveAll(tempDir)

	// ListNetworks without docker service -> 503
	req := httptest.NewRequest("GET", "/api/v1/networks", nil)
	w := httptest.NewRecorder()
	h.ListNetworks(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", w.Code)
	}

	// CreateNetwork without docker service -> 503
	body := []byte(`{"name":"test-net","driver":"bridge"}`)
	req = httptest.NewRequest("POST", "/api/v1/networks", bytes.NewReader(body))
	w = httptest.NewRecorder()
	h.CreateNetwork(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", w.Code)
	}
}

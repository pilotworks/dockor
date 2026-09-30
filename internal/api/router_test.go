package api_test

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/pilotworks/dockor/internal/api"
	"github.com/pilotworks/dockor/internal/api/handlers"
)

func TestRouter_SPA_Serving(t *testing.T) {
	// 1. Create a mock web distribution directory with index.html and static asset
	tempDir, err := os.MkdirTemp("", "dockor-web-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	indexContent := "<html><head><title>Dockor Test</title></head><body><div id='root'></div></body></html>"
	if err := os.WriteFile(filepath.Join(tempDir, "index.html"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("Failed to write index.html: %v", err)
	}

	assetsDir := filepath.Join(tempDir, "assets")
	if err := os.MkdirAll(assetsDir, 0755); err != nil {
		t.Fatalf("Failed to create assets dir: %v", err)
	}
	jsContent := "console.log('dockor bundle');"
	if err := os.WriteFile(filepath.Join(assetsDir, "bundle.js"), []byte(jsContent), 0644); err != nil {
		t.Fatalf("Failed to write bundle.js: %v", err)
	}

	// 2. Initialize router with tempDir
	handler := handlers.NewAPIHandler(nil, nil, nil, nil)
	router := api.NewRouter(handler, tempDir)

	// Test 3.1: Root path "/" should serve index.html
	reqRoot := httptest.NewRequest("GET", "/", nil)
	recRoot := httptest.NewRecorder()
	router.ServeHTTP(recRoot, reqRoot)

	if recRoot.Code != http.StatusOK {
		t.Errorf("Expected 200 OK for root, got %d", recRoot.Code)
	}
	if recRoot.Body.String() != indexContent {
		t.Errorf("Expected indexContent, got %s", recRoot.Body.String())
	}

	// Test 3.2: SPA route "/containers" should fallback to index.html
	reqSPA := httptest.NewRequest("GET", "/containers", nil)
	recSPA := httptest.NewRecorder()
	router.ServeHTTP(recSPA, reqSPA)

	if recSPA.Code != http.StatusOK {
		t.Errorf("Expected 200 OK for SPA fallback route, got %d", recSPA.Code)
	}
	if recSPA.Body.String() != indexContent {
		t.Errorf("Expected index.html content on SPA fallback, got %s", recSPA.Body.String())
	}

	// Test 3.3: Direct static asset "/assets/bundle.js" should be served with cache headers
	reqAsset := httptest.NewRequest("GET", "/assets/bundle.js", nil)
	recAsset := httptest.NewRecorder()
	router.ServeHTTP(recAsset, reqAsset)

	if recAsset.Code != http.StatusOK {
		t.Errorf("Expected 200 OK for static asset, got %d", recAsset.Code)
	}
	if recAsset.Body.String() != jsContent {
		t.Errorf("Expected bundle.js content, got %s", recAsset.Body.String())
	}
	if recAsset.Header().Get("Cache-Control") == "" {
		t.Errorf("Expected Cache-Control header for static asset")
	}

	// Test 3.4: Unknown /api route should NOT fallback to index.html; should return 404
	reqAPI404 := httptest.NewRequest("GET", "/api/v1/non-existent-endpoint", nil)
	recAPI404 := httptest.NewRecorder()
	router.ServeHTTP(recAPI404, reqAPI404)

	if recAPI404.Code != http.StatusNotFound {
		t.Errorf("Expected 404 Not Found for invalid API route, got %d", recAPI404.Code)
	}
}

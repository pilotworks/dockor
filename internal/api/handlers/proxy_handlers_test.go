package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/pilotworks/dockor/internal/models"
	"github.com/pilotworks/dockor/internal/repository"
	"github.com/pilotworks/dockor/internal/service"
)

func setupTestProxyEnv(t *testing.T) (*APIHandler, *repository.Repository, *service.CaddyService) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test_proxy.db")
	t.Cleanup(func() { os.RemoveAll(tempDir) })

	db, err := repository.NewDB(dbPath)
	if err != nil {
		t.Fatalf("failed to init db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	repo := repository.NewRepository(db)
	caddySvc := service.NewCaddyService(repo, tempDir, "http://127.0.0.1:20199", "admin@dockor.local")

	h := NewAPIHandler(repo, nil, nil, nil)
	h.SetCaddyService(caddySvc)
	h.SetJWTSecret("test-secret-proxy-key-12345")

	return h, repo, caddySvc
}

func TestProxyRoutesCRUDAndToggle(t *testing.T) {
	h, _, _ := setupTestProxyEnv(t)

	// 1. Initially empty list
	req := httptest.NewRequest(http.MethodGet, "/api/v1/proxy/routes", nil)
	rec := httptest.NewRecorder()
	h.ListProxyRoutes(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var routes []models.ProxyRoute
	_ = json.Unmarshal(rec.Body.Bytes(), &routes)
	if len(routes) != 0 {
		t.Fatalf("expected 0 routes, got %d", len(routes))
	}

	// 2. Create route
	createPayload := models.CreateProxyRoutePayload{
		Domain:    "app.dockor.local",
		TargetURL: "localhost:3000",
		SSLMode:   models.SSLModeLetsEncrypt,
	}
	bodyBytes, _ := json.Marshal(createPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/proxy/routes", bytes.NewReader(bodyBytes))
	rec = httptest.NewRecorder()
	h.CreateProxyRoute(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", rec.Code, rec.Body.String())
	}
	var created models.ProxyRoute
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}
	if created.Domain != "app.dockor.local" || !created.Enabled {
		t.Fatalf("unexpected created route: %+v", created)
	}

	// 3. Duplicate domain returns 409 Conflict
	req = httptest.NewRequest(http.MethodPost, "/api/v1/proxy/routes", bytes.NewReader(bodyBytes))
	rec = httptest.NewRecorder()
	h.CreateProxyRoute(rec, req)
	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409 Conflict for duplicate domain, got %d", rec.Code)
	}

	// 4. Get by ID
	rCtx := chi.NewRouteContext()
	rCtx.URLParams.Add("id", created.ID)
	req = httptest.NewRequest(http.MethodGet, "/api/v1/proxy/routes/"+created.ID, nil)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rCtx))
	rec = httptest.NewRecorder()
	h.GetProxyRoute(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}

	// 5. Update route
	newTarget := "localhost:8080"
	updatePayload := models.UpdateProxyRoutePayload{
		TargetURL: newTarget,
	}
	bodyBytes, _ = json.Marshal(updatePayload)
	req = httptest.NewRequest(http.MethodPut, "/api/v1/proxy/routes/"+created.ID, bytes.NewReader(bodyBytes))
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rCtx))
	rec = httptest.NewRecorder()
	h.UpdateProxyRoute(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on update, got %d: %s", rec.Code, rec.Body.String())
	}

	// 6. Toggle route
	togglePayload := map[string]bool{"enabled": false}
	bodyBytes, _ = json.Marshal(togglePayload)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/proxy/routes/"+created.ID+"/toggle", bytes.NewReader(bodyBytes))
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rCtx))
	rec = httptest.NewRecorder()
	h.ToggleProxyRoute(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on toggle, got %d: %s", rec.Code, rec.Body.String())
	}
	var toggled models.ProxyRoute
	_ = json.Unmarshal(rec.Body.Bytes(), &toggled)
	if toggled.Enabled != false {
		t.Fatalf("expected route to be disabled")
	}

	// 7. Get Caddyfile preview
	req = httptest.NewRequest(http.MethodGet, "/api/v1/proxy/caddyfile", nil)
	rec = httptest.NewRecorder()
	h.GetCaddyfile(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for caddyfile, got %d", rec.Code)
	}

	// 8. Delete route
	req = httptest.NewRequest(http.MethodDelete, "/api/v1/proxy/routes/"+created.ID, nil)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rCtx))
	rec = httptest.NewRecorder()
	h.DeleteProxyRoute(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on delete, got %d", rec.Code)
	}
}

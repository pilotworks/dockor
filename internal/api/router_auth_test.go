package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/pilotworks/dockor/internal/api"
	"github.com/pilotworks/dockor/internal/api/handlers"
	"github.com/pilotworks/dockor/internal/crypto"
	"github.com/pilotworks/dockor/internal/models"
	"github.com/pilotworks/dockor/internal/repository"
	"github.com/pilotworks/dockor/internal/service"
)

func setupTestRouter(t *testing.T) (http.Handler, *repository.Repository, string, string) {
	tempDir, err := os.MkdirTemp("", "dockor-router-auth-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	dbPath := tempDir + "/test.db"
	db, err := repository.NewDB(dbPath)
	if err != nil {
		t.Fatalf("failed to create db: %v", err)
	}

	repo := repository.NewRepository(db)
	_ = repo.EnsureDefaultAdmin(context.Background())

	templateEng := service.NewTemplateEngine(tempDir + "/templates")
	composeSvc := service.NewComposeService("", tempDir)

	jwtSecret := "test-jwt-secret-key-12345"
	h := handlers.NewAPIHandler(repo, nil, templateEng, composeSvc)
	h.SetJWTSecret(jwtSecret)

	router := api.NewRouter(h)
	return router, repo, jwtSecret, tempDir
}

func TestRouter_AuthAndRBAC(t *testing.T) {
	router, repo, jwtSecret, tempDir := setupTestRouter(t)
	defer os.RemoveAll(tempDir)

	// 1. Health is public
	reqHealth := httptest.NewRequest("GET", "/api/v1/health", nil)
	recHealth := httptest.NewRecorder()
	router.ServeHTTP(recHealth, reqHealth)
	if recHealth.Code != http.StatusOK {
		t.Fatalf("expected 200 for health check, got %d", recHealth.Code)
	}

	// 2. Unauthenticated request to protected route -> 401
	reqUnauth := httptest.NewRequest("GET", "/api/v1/auth/me", nil)
	recUnauth := httptest.NewRecorder()
	router.ServeHTTP(recUnauth, reqUnauth)
	if recUnauth.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthenticated /me, got %d", recUnauth.Code)
	}

	// 3. Login returns valid token
	loginBody := []byte(`{"username":"admin","password":"admin123"}`)
	reqLogin := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(loginBody))
	recLogin := httptest.NewRecorder()
	router.ServeHTTP(recLogin, reqLogin)
	if recLogin.Code != http.StatusOK {
		t.Fatalf("expected 200 for login, got %d", recLogin.Code)
	}

	var loginResp handlers.LoginResponse
	_ = json.Unmarshal(recLogin.Body.Bytes(), &loginResp)
	adminToken := loginResp.AccessToken

	// 4. Admin accesses /auth/me -> 200
	reqMe := httptest.NewRequest("GET", "/api/v1/auth/me", nil)
	reqMe.Header.Set("Authorization", "Bearer "+adminToken)
	recMe := httptest.NewRecorder()
	router.ServeHTTP(recMe, reqMe)
	if recMe.Code != http.StatusOK {
		t.Fatalf("expected 200 for authenticated /me, got %d: %s", recMe.Code, recMe.Body.String())
	}

	// 5. Admin accesses /users -> 200
	reqUsers := httptest.NewRequest("GET", "/api/v1/users", nil)
	reqUsers.Header.Set("Authorization", "Bearer "+adminToken)
	recUsers := httptest.NewRecorder()
	router.ServeHTTP(recUsers, reqUsers)
	if recUsers.Code != http.StatusOK {
		t.Fatalf("expected 200 for admin on /users, got %d: %s", recUsers.Code, recUsers.Body.String())
	}

	// 6. Create Viewer user and test RBAC permissions
	viewerHash, _ := crypto.HashPassword("viewer123")
	viewerUser := &models.User{
		ID:           "usr_viewer_test",
		Username:     "viewer",
		Email:        "viewer@example.com",
		PasswordHash: viewerHash,
		Role:         models.RoleViewer,
	}
	_ = repo.CreateUser(context.Background(), viewerUser)

	viewerToken, _ := crypto.GenerateJWT(crypto.JWTClaims{
		Subject:   viewerUser.ID,
		Username:  viewerUser.Username,
		Email:     viewerUser.Email,
		Role:      string(viewerUser.Role),
		ExpiresAt: time.Now().UTC().Add(1 * time.Hour).Unix(),
	}, jwtSecret)

	// Viewer can read templates
	reqTmpl := httptest.NewRequest("GET", "/api/v1/templates", nil)
	reqTmpl.Header.Set("Authorization", "Bearer "+viewerToken)
	recTmpl := httptest.NewRecorder()
	router.ServeHTTP(recTmpl, reqTmpl)
	if recTmpl.Code != http.StatusOK {
		t.Fatalf("expected 200 for viewer reading templates, got %d", recTmpl.Code)
	}

	// Viewer cannot access Admin routes (/users) -> 403 Forbidden
	reqViewerAdmin := httptest.NewRequest("GET", "/api/v1/users", nil)
	reqViewerAdmin.Header.Set("Authorization", "Bearer "+viewerToken)
	recViewerAdmin := httptest.NewRecorder()
	router.ServeHTTP(recViewerAdmin, reqViewerAdmin)
	if recViewerAdmin.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for viewer on /users, got %d", recViewerAdmin.Code)
	}

	// Viewer cannot execute mutation actions (/containers write) -> 403 Forbidden
	reqViewerCreate := httptest.NewRequest("POST", "/api/v1/containers", bytes.NewReader([]byte(`{}`)))
	reqViewerCreate.Header.Set("Authorization", "Bearer "+viewerToken)
	recViewerCreate := httptest.NewRecorder()
	router.ServeHTTP(recViewerCreate, reqViewerCreate)
	if recViewerCreate.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for viewer creating container, got %d", recViewerCreate.Code)
	}

	// 7. Query token param for SSE / WebSocket / file downloads
	reqQueryToken := httptest.NewRequest("GET", "/api/v1/auth/me?token="+adminToken, nil)
	recQueryToken := httptest.NewRecorder()
	router.ServeHTTP(recQueryToken, reqQueryToken)
	if recQueryToken.Code != http.StatusOK {
		t.Fatalf("expected 200 with query token param, got %d", recQueryToken.Code)
	}
}

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
)

func TestAuth_Login_Success_And_GetCurrentUser(t *testing.T) {
	h, repo, tempDir := setupTestHandler(t)
	defer os.RemoveAll(tempDir)

	if err := repo.EnsureDefaultAdmin(context.Background()); err != nil {
		t.Fatalf("failed to ensure default admin: %v", err)
	}

	// 1. Successful Login
	loginBody := []byte(`{"username":"admin","password":"admin123"}`)
	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(loginBody))
	w := httptest.NewRecorder()
	h.Login(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	var res LoginResponse
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode login response: %v", err)
	}
	if res.AccessToken == "" {
		t.Fatalf("expected non-empty access token")
	}
	if res.User == nil || res.User.Username != "admin" || res.User.Role != models.RoleAdmin {
		t.Fatalf("unexpected user in login response: %+v", res.User)
	}

	// 2. Failed Login with wrong password
	badBody := []byte(`{"username":"admin","password":"wrongpassword"}`)
	reqBad := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(badBody))
	wBad := httptest.NewRecorder()
	h.Login(wBad, reqBad)

	if wBad.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized, got %d", wBad.Code)
	}

	// 3. GetCurrentUser with context
	ctx := SetUserInContext(context.Background(), res.User)
	reqMe := httptest.NewRequest("GET", "/api/v1/auth/me", nil).WithContext(ctx)
	wMe := httptest.NewRecorder()
	h.GetCurrentUser(wMe, reqMe)

	if wMe.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for /me, got %d", wMe.Code)
	}
	var me models.User
	_ = json.Unmarshal(wMe.Body.Bytes(), &me)
	if me.Username != "admin" {
		t.Fatalf("expected username admin, got %s", me.Username)
	}
}

func TestAuth_ChangePassword(t *testing.T) {
	h, repo, tempDir := setupTestHandler(t)
	defer os.RemoveAll(tempDir)

	_ = repo.EnsureDefaultAdmin(context.Background())
	admin, _ := repo.GetUserByUsername(context.Background(), "admin")
	ctx := SetUserInContext(context.Background(), admin)

	// 1. Wrong old password
	wrongBody := []byte(`{"old_password":"wrong","new_password":"newpassword123"}`)
	req := httptest.NewRequest("POST", "/api/v1/auth/change-password", bytes.NewReader(wrongBody)).WithContext(ctx)
	w := httptest.NewRecorder()
	h.ChangePassword(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request, got %d", w.Code)
	}

	// 2. Too short new password
	shortBody := []byte(`{"old_password":"admin123","new_password":"123"}`)
	reqShort := httptest.NewRequest("POST", "/api/v1/auth/change-password", bytes.NewReader(shortBody)).WithContext(ctx)
	wShort := httptest.NewRecorder()
	h.ChangePassword(wShort, reqShort)
	if wShort.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request, got %d", wShort.Code)
	}

	// 3. Successful change password
	okBody := []byte(`{"old_password":"admin123","new_password":"brandnewpassword123"}`)
	reqOK := httptest.NewRequest("POST", "/api/v1/auth/change-password", bytes.NewReader(okBody)).WithContext(ctx)
	wOK := httptest.NewRecorder()
	h.ChangePassword(wOK, reqOK)
	if wOK.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", wOK.Code, wOK.Body.String())
	}

	// Verify login with new password succeeds
	loginBody := []byte(`{"username":"admin","password":"brandnewpassword123"}`)
	reqLogin := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(loginBody))
	wLogin := httptest.NewRecorder()
	h.Login(wLogin, reqLogin)
	if wLogin.Code != http.StatusOK {
		t.Fatalf("expected 200 OK after password change, got %d", wLogin.Code)
	}
}

func TestUserManagement_CRUD(t *testing.T) {
	h, repo, tempDir := setupTestHandler(t)
	defer os.RemoveAll(tempDir)

	_ = repo.EnsureDefaultAdmin(context.Background())
	admin, _ := repo.GetUserByUsername(context.Background(), "admin")
	adminCtx := SetUserInContext(context.Background(), admin)

	// 1. Create User
	createUserBody := []byte(`{"username":"developer1","email":"dev1@example.com","password":"password123","role":"developer"}`)
	reqCreate := httptest.NewRequest("POST", "/api/v1/users", bytes.NewReader(createUserBody)).WithContext(adminCtx)
	wCreate := httptest.NewRecorder()
	h.CreateUser(wCreate, reqCreate)
	if wCreate.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", wCreate.Code, wCreate.Body.String())
	}

	var created models.User
	_ = json.Unmarshal(wCreate.Body.Bytes(), &created)
	if created.Username != "developer1" || created.Role != models.RoleDeveloper {
		t.Fatalf("unexpected created user: %+v", created)
	}

	// 2. List Users
	reqList := httptest.NewRequest("GET", "/api/v1/users", nil).WithContext(adminCtx)
	wList := httptest.NewRecorder()
	h.ListUsers(wList, reqList)
	if wList.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", wList.Code)
	}
	var users []models.User
	_ = json.Unmarshal(wList.Body.Bytes(), &users)
	if len(users) != 2 {
		t.Fatalf("expected 2 users, got %d", len(users))
	}

	// 3. Update User
	updateBody := []byte(`{"email":"updated_dev1@example.com","role":"viewer"}`)
	reqUpdate := httptest.NewRequest("PUT", "/api/v1/users/"+created.ID, bytes.NewReader(updateBody)).WithContext(adminCtx)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", created.ID)
	reqUpdate = reqUpdate.WithContext(context.WithValue(reqUpdate.Context(), chi.RouteCtxKey, rctx))
	wUpdate := httptest.NewRecorder()
	h.UpdateUser(wUpdate, reqUpdate)
	if wUpdate.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", wUpdate.Code, wUpdate.Body.String())
	}

	// 4. Delete self protection
	reqDelSelf := httptest.NewRequest("DELETE", "/api/v1/users/"+admin.ID, nil).WithContext(adminCtx)
	rctxSelf := chi.NewRouteContext()
	rctxSelf.URLParams.Add("id", admin.ID)
	reqDelSelf = reqDelSelf.WithContext(context.WithValue(reqDelSelf.Context(), chi.RouteCtxKey, rctxSelf))
	wDelSelf := httptest.NewRecorder()
	h.DeleteUser(wDelSelf, reqDelSelf)
	if wDelSelf.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request deleting self, got %d", wDelSelf.Code)
	}

	// 5. Delete User
	reqDel := httptest.NewRequest("DELETE", "/api/v1/users/"+created.ID, nil).WithContext(adminCtx)
	rctxDel := chi.NewRouteContext()
	rctxDel.URLParams.Add("id", created.ID)
	reqDel = reqDel.WithContext(context.WithValue(reqDel.Context(), chi.RouteCtxKey, rctxDel))
	wDel := httptest.NewRecorder()
	h.DeleteUser(wDel, reqDel)
	if wDel.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", wDel.Code)
	}
}

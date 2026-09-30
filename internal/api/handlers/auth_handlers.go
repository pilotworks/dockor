package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/pilotworks/dockor/internal/crypto"
	"github.com/pilotworks/dockor/internal/models"
)

type contextKey string

const UserContextKey contextKey = "dockor_auth_user"

// GetUserFromContext extracts the authenticated User model from request context
func GetUserFromContext(ctx context.Context) *models.User {
	if u, ok := ctx.Value(UserContextKey).(*models.User); ok {
		return u
	}
	return nil
}

// SetUserInContext injects the authenticated User model into request context
func SetUserInContext(ctx context.Context, user *models.User) context.Context {
	return context.WithValue(ctx, UserContextKey, user)
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	AccessToken string       `json:"access_token"`
	User        *models.User `json:"user"`
}

// Login authenticates a user and returns an HMAC-SHA256 signed JWT token
func (h *APIHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "Username and password are required")
		return
	}

	user, err := h.repo.GetUserByUsername(r.Context(), req.Username)
	if err != nil || !crypto.CheckPasswordHash(req.Password, user.PasswordHash) {
		writeError(w, http.StatusUnauthorized, "Invalid username or password")
		return
	}

	claims := crypto.JWTClaims{
		Subject:   user.ID,
		Username:  user.Username,
		Email:     user.Email,
		Role:      string(user.Role),
		ExpiresAt: time.Now().UTC().Add(7 * 24 * time.Hour).Unix(),
		IssuedAt:  time.Now().UTC().Unix(),
	}

	token, err := crypto.GenerateJWT(claims, h.jwtSecret)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to generate authentication token")
		return
	}

	writeJSON(w, http.StatusOK, LoginResponse{
		AccessToken: token,
		User:        user,
	})
}

// GetCurrentUser returns the profile of the currently authenticated user
func (h *APIHandler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	curr := GetUserFromContext(r.Context())
	if curr == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	user, err := h.repo.GetUserByID(r.Context(), curr.ID)
	if err != nil {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}

	writeJSON(w, http.StatusOK, user)
}

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}

// ChangePassword updates the password of the currently authenticated user
func (h *APIHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	curr := GetUserFromContext(r.Context())
	if curr == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if len(req.NewPassword) < 6 {
		writeError(w, http.StatusBadRequest, "New password must be at least 6 characters")
		return
	}

	user, err := h.repo.GetUserByID(r.Context(), curr.ID)
	if err != nil {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}

	if !crypto.CheckPasswordHash(req.OldPassword, user.PasswordHash) {
		writeError(w, http.StatusBadRequest, "Current password is incorrect")
		return
	}

	newHash, err := crypto.HashPassword(req.NewPassword)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to hash new password")
		return
	}

	if err := h.repo.UpdateUserPassword(r.Context(), user.ID, newHash); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update password: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "success",
		"message": "Password changed successfully",
	})
}

// --- User Management Handlers (Admin Only) ---

// ListUsers lists all registered users in the system
func (h *APIHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.repo.ListUsers(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to list users: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, users)
}

type CreateUserRequest struct {
	Username string          `json:"username"`
	Email    string          `json:"email"`
	Password string          `json:"password"`
	Role     models.UserRole `json:"role"`
}

// CreateUser registers a new user with a specified role
func (h *APIHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	if len(req.Username) < 3 {
		writeError(w, http.StatusBadRequest, "Username must be at least 3 characters")
		return
	}
	if !strings.Contains(req.Email, "@") {
		writeError(w, http.StatusBadRequest, "Valid email address is required")
		return
	}
	if len(req.Password) < 6 {
		writeError(w, http.StatusBadRequest, "Password must be at least 6 characters")
		return
	}

	role := req.Role
	if role != models.RoleAdmin && role != models.RoleDeveloper && role != models.RoleViewer {
		role = models.RoleDeveloper
	}

	// Check if username already exists
	if _, err := h.repo.GetUserByUsername(r.Context(), req.Username); err == nil {
		writeError(w, http.StatusConflict, "Username is already taken")
		return
	}

	hashedPassword, err := crypto.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}

	newUser := &models.User{
		ID:           "usr_" + uuid.New().String()[:8],
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: hashedPassword,
		Role:         role,
	}

	if err := h.repo.CreateUser(r.Context(), newUser); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create user: "+err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, newUser)
}

// GetUser retrieves a user by ID
func (h *APIHandler) GetUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user, err := h.repo.GetUserByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

type UpdateUserRequest struct {
	Email    string          `json:"email"`
	Role     models.UserRole `json:"role"`
	Password string          `json:"password,omitempty"`
}

// UpdateUser modifies user attributes and optionally resets password
func (h *APIHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	curr := GetUserFromContext(r.Context())

	user, err := h.repo.GetUserByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}

	var req UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email != "" && !strings.Contains(req.Email, "@") {
		writeError(w, http.StatusBadRequest, "Valid email address is required")
		return
	}
	if req.Email != "" {
		user.Email = req.Email
	}

	if req.Role == models.RoleAdmin || req.Role == models.RoleDeveloper || req.Role == models.RoleViewer {
		// Prevent demoting the last remaining admin
		if user.Role == models.RoleAdmin && req.Role != models.RoleAdmin {
			users, _ := h.repo.ListUsers(r.Context())
			adminCount := 0
			for _, u := range users {
				if u.Role == models.RoleAdmin {
					adminCount++
				}
			}
			if adminCount <= 1 {
				writeError(w, http.StatusBadRequest, "Cannot demote the only remaining administrator")
				return
			}
		}
		user.Role = req.Role
	}

	if err := h.repo.UpdateUser(r.Context(), user); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update user: "+err.Error())
		return
	}

	// Update password if requested
	if strings.TrimSpace(req.Password) != "" {
		if len(req.Password) < 6 {
			writeError(w, http.StatusBadRequest, "Password must be at least 6 characters")
			return
		}
		newHash, err := crypto.HashPassword(req.Password)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to hash password")
			return
		}
		if err := h.repo.UpdateUserPassword(r.Context(), id, newHash); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to update password: "+err.Error())
			return
		}
	}

	// Return fresh record
	updated, _ := h.repo.GetUserByID(r.Context(), id)
	if updated == nil {
		updated = user
	}
	_ = curr
	writeJSON(w, http.StatusOK, updated)
}

// DeleteUser removes a user account from the system
func (h *APIHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	curr := GetUserFromContext(r.Context())

	if curr != nil && curr.ID == id {
		writeError(w, http.StatusBadRequest, "Cannot delete your own account")
		return
	}

	targetUser, err := h.repo.GetUserByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}

	if targetUser.Role == models.RoleAdmin {
		users, _ := h.repo.ListUsers(r.Context())
		adminCount := 0
		for _, u := range users {
			if u.Role == models.RoleAdmin {
				adminCount++
			}
		}
		if adminCount <= 1 {
			writeError(w, http.StatusBadRequest, "Cannot delete the only remaining administrator")
			return
		}
	}

	if err := h.repo.DeleteUser(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to delete user: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "success",
		"message": "User deleted successfully",
		"id":      id,
	})
}

package api

import (
	"net/http"
	"strings"

	"github.com/pilotworks/dockor/internal/api/handlers"
	"github.com/pilotworks/dockor/internal/crypto"
	"github.com/pilotworks/dockor/internal/models"
	"github.com/pilotworks/dockor/internal/repository"
)

// Authenticate returns a middleware that validates JWT tokens and injects the user into request context
func Authenticate(repo *repository.Repository, jwtSecret string) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var token string
			authHeader := r.Header.Get("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				token = strings.TrimPrefix(authHeader, "Bearer ")
			} else if qToken := r.URL.Query().Get("token"); qToken != "" {
				token = qToken
			} else if wsProto := r.Header.Get("Sec-WebSocket-Protocol"); wsProto != "" {
				parts := strings.Split(wsProto, ",")
				for _, p := range parts {
					p = strings.TrimSpace(p)
					if strings.HasPrefix(p, "token.") {
						token = strings.TrimPrefix(p, "token.")
						break
					}
				}
			}

			if token == "" {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = w.Write([]byte(`{"error":"Authentication required"}`))
				return
			}

			claims, err := crypto.ValidateJWT(token, jwtSecret)
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = w.Write([]byte(`{"error":"Invalid or expired authentication token"}`))
				return
			}

			// Validate user in repository if available
			var user *models.User
			if repo != nil {
				user, err = repo.GetUserByID(r.Context(), claims.Subject)
			}
			if err != nil || user == nil {
				user = &models.User{
					ID:       claims.Subject,
					Username: claims.Username,
					Email:    claims.Email,
					Role:     models.UserRole(claims.Role),
				}
			}

			ctx := handlers.SetUserInContext(r.Context(), user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole checks that the authenticated user possesses one of the permitted roles
func RequireRole(roles ...models.UserRole) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := handlers.GetUserFromContext(r.Context())
			if user == nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = w.Write([]byte(`{"error":"Authentication required"}`))
				return
			}

			allowed := false
			for _, r := range roles {
				if user.Role == r {
					allowed = true
					break
				}
			}

			if !allowed {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				_, _ = w.Write([]byte(`{"error":"Forbidden: insufficient permissions for this operation"}`))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

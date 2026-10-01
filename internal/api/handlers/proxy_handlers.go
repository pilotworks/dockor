package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/pilotworks/dockor/internal/models"
)

// ListProxyRoutes returns all configured reverse proxy routes
func (h *APIHandler) ListProxyRoutes(w http.ResponseWriter, r *http.Request) {
	routes, err := h.repo.ListProxyRoutes(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if routes == nil {
		routes = []models.ProxyRoute{}
	}
	writeJSON(w, http.StatusOK, routes)
}

// GetProxyRoute returns a single reverse proxy route by ID
func (h *APIHandler) GetProxyRoute(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	route, err := h.repo.GetProxyRoute(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, route)
}

// CreateProxyRoute registers a new domain route and synchronizes Caddy
func (h *APIHandler) CreateProxyRoute(w http.ResponseWriter, r *http.Request) {
	var payload models.CreateProxyRoutePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	payload.Domain = strings.TrimSpace(payload.Domain)
	payload.TargetURL = strings.TrimSpace(payload.TargetURL)

	if payload.Domain == "" {
		writeError(w, http.StatusBadRequest, "Domain is required")
		return
	}
	if payload.TargetURL == "" {
		writeError(w, http.StatusBadRequest, "Target URL is required")
		return
	}

	// Check if domain already exists
	existing, err := h.repo.GetProxyRouteByDomain(r.Context(), payload.Domain)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if existing != nil {
		writeError(w, http.StatusConflict, "Domain route already exists")
		return
	}

	sslMode := payload.SSLMode
	if sslMode == "" {
		sslMode = models.SSLModeLetsEncrypt
	}

	enabled := true
	if payload.Enabled != nil {
		enabled = *payload.Enabled
	}

	route := models.ProxyRoute{
		Domain:      payload.Domain,
		TargetURL:   payload.TargetURL,
		ContainerID: payload.ContainerID,
		StackID:     payload.StackID,
		SSLMode:     sslMode,
		Enabled:     enabled,
		Email:       payload.Email,
	}

	if err := h.repo.CreateProxyRoute(r.Context(), &route); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Trigger hot-reload in Caddy
	if h.caddySvc != nil {
		_ = h.caddySvc.Sync(r.Context())
	}

	writeJSON(w, http.StatusCreated, route)
}

// UpdateProxyRoute modifies an existing proxy route
func (h *APIHandler) UpdateProxyRoute(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	route, err := h.repo.GetProxyRoute(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	var payload models.UpdateProxyRoutePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if payload.Domain != "" {
		trimmedDomain := strings.TrimSpace(payload.Domain)
		if trimmedDomain != route.Domain {
			existing, err := h.repo.GetProxyRouteByDomain(r.Context(), trimmedDomain)
			if err != nil {
				writeError(w, http.StatusInternalServerError, err.Error())
				return
			}
			if existing != nil && existing.ID != id {
				writeError(w, http.StatusConflict, "Domain name already registered to another route")
				return
			}
			route.Domain = trimmedDomain
		}
	}

	if payload.TargetURL != "" {
		route.TargetURL = strings.TrimSpace(payload.TargetURL)
	}
	if payload.ContainerID != "" {
		route.ContainerID = payload.ContainerID
	}
	if payload.StackID != "" {
		route.StackID = payload.StackID
	}
	if payload.SSLMode != nil {
		route.SSLMode = *payload.SSLMode
	}
	if payload.Enabled != nil {
		route.Enabled = *payload.Enabled
	}
	if payload.Email != "" {
		route.Email = strings.TrimSpace(payload.Email)
	}

	if err := h.repo.UpdateProxyRoute(r.Context(), route); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if h.caddySvc != nil {
		_ = h.caddySvc.Sync(r.Context())
	}

	writeJSON(w, http.StatusOK, route)
}

// DeleteProxyRoute removes a proxy route and synchronizes Caddy
func (h *APIHandler) DeleteProxyRoute(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if _, err := h.repo.GetProxyRoute(r.Context(), id); err != nil {
		writeError(w, http.StatusNotFound, "Proxy route not found")
		return
	}

	if err := h.repo.DeleteProxyRoute(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if h.caddySvc != nil {
		_ = h.caddySvc.Sync(r.Context())
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Proxy route deleted successfully"})
}

// ToggleProxyRoute switches route enabled/disabled state
func (h *APIHandler) ToggleProxyRoute(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	route, err := h.repo.GetProxyRoute(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "Proxy route not found")
		return
	}

	var payload struct {
		Enabled bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		// Toggle current state if body is empty or invalid
		payload.Enabled = !route.Enabled
	}

	if err := h.repo.ToggleProxyRoute(r.Context(), id, payload.Enabled); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if h.caddySvc != nil {
		_ = h.caddySvc.Sync(r.Context())
	}

	route.Enabled = payload.Enabled
	writeJSON(w, http.StatusOK, route)
}

// GetProxyStatus returns Caddy reverse proxy daemon and route health status
func (h *APIHandler) GetProxyStatus(w http.ResponseWriter, r *http.Request) {
	if h.caddySvc == nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"running":       false,
			"active_routes": 0,
			"admin_url":     "",
			"message":       "Caddy service not initialized",
		})
		return
	}

	status, err := h.caddySvc.GetStatus(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, status)
}

// SyncProxy forces a hot-reload and Caddyfile write
func (h *APIHandler) SyncProxy(w http.ResponseWriter, r *http.Request) {
	if h.caddySvc == nil {
		writeError(w, http.StatusBadRequest, "Caddy service is not enabled")
		return
	}

	if err := h.caddySvc.Sync(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Caddy reverse proxy configuration synchronized successfully"})
}

// GetCaddyfile returns the raw generated Caddyfile configuration
func (h *APIHandler) GetCaddyfile(w http.ResponseWriter, r *http.Request) {
	if h.caddySvc == nil {
		writeError(w, http.StatusBadRequest, "Caddy service not enabled")
		return
	}

	caddyfile, err := h.caddySvc.GetCaddyfile(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"caddyfile": caddyfile})
}

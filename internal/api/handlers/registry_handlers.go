package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/pilotworks/dockor/internal/crypto"
	"github.com/pilotworks/dockor/internal/models"
)

// ListRegistries returns all configured container registries
func (h *APIHandler) ListRegistries(w http.ResponseWriter, r *http.Request) {
	if h.repo == nil {
		writeError(w, http.StatusServiceUnavailable, "database repository not initialized")
		return
	}

	registries, err := h.repo.ListRegistries(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to query registries: "+err.Error())
		return
	}
	if registries == nil {
		registries = []models.Registry{}
	}

	writeJSON(w, http.StatusOK, registries)
}

// GetRegistry returns a specific registry by ID
func (h *APIHandler) GetRegistry(w http.ResponseWriter, r *http.Request) {
	if h.repo == nil {
		writeError(w, http.StatusServiceUnavailable, "database repository not initialized")
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "registry id is required")
		return
	}

	reg, err := h.repo.GetRegistry(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "registry not found")
		return
	}

	writeJSON(w, http.StatusOK, reg)
}

// CreateRegistry creates a new registry, encrypting the password with the separate secret key
func (h *APIHandler) CreateRegistry(w http.ResponseWriter, r *http.Request) {
	if h.repo == nil {
		writeError(w, http.StatusServiceUnavailable, "database repository not initialized")
		return
	}

	var payload models.CreateRegistryPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	if payload.Name == "" || payload.ServerAddress == "" || payload.Username == "" {
		writeError(w, http.StatusBadRequest, "name, server_address, and username are required")
		return
	}

	encryptedPass := ""
	if payload.Password != "" {
		enc, err := crypto.Encrypt(payload.Password, h.secretKey)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to encrypt password: "+err.Error())
			return
		}
		encryptedPass = enc
	}

	reg := models.Registry{
		Name:              payload.Name,
		ServerAddress:     payload.ServerAddress,
		Username:          payload.Username,
		EncryptedPassword: encryptedPass,
		IsDefault:         payload.IsDefault,
	}

	if err := h.repo.CreateRegistry(r.Context(), &reg); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create registry: "+err.Error())
		return
	}

	reg.HasPassword = encryptedPass != ""
	writeJSON(w, http.StatusCreated, reg)
}

// UpdateRegistry updates an existing registry
func (h *APIHandler) UpdateRegistry(w http.ResponseWriter, r *http.Request) {
	if h.repo == nil {
		writeError(w, http.StatusServiceUnavailable, "database repository not initialized")
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "registry id is required")
		return
	}

	var payload models.UpdateRegistryPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	existing, err := h.repo.GetRegistry(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "registry not found")
		return
	}

	existing.Name = payload.Name
	existing.ServerAddress = payload.ServerAddress
	existing.Username = payload.Username
	existing.IsDefault = payload.IsDefault

	if payload.Password != "" {
		enc, err := crypto.Encrypt(payload.Password, h.secretKey)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to encrypt password: "+err.Error())
			return
		}
		existing.EncryptedPassword = enc
	}

	if err := h.repo.UpdateRegistry(r.Context(), existing); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update registry: "+err.Error())
		return
	}

	existing.HasPassword = existing.EncryptedPassword != ""
	writeJSON(w, http.StatusOK, existing)
}

// DeleteRegistry removes a registry
func (h *APIHandler) DeleteRegistry(w http.ResponseWriter, r *http.Request) {
	if h.repo == nil {
		writeError(w, http.StatusServiceUnavailable, "database repository not initialized")
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "registry id is required")
		return
	}

	if err := h.repo.DeleteRegistry(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete registry: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted", "id": id})
}

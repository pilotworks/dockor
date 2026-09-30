package handlers

import (
	"encoding/json"
	"net/http"
	"net/url"

	"github.com/go-chi/chi/v5"
	"github.com/pilotworks/dockor/internal/models"
)

func (h *APIHandler) ListVolumes(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service not connected")
		return
	}

	volumes, err := h.dockerSvc.ListVolumes(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to list volumes: "+err.Error())
		return
	}
	if volumes == nil {
		volumes = []models.VolumeSummary{}
	}
	writeJSON(w, http.StatusOK, volumes)
}

func (h *APIHandler) GetVolume(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service not connected")
		return
	}

	name := chi.URLParam(r, "name")
	if unescaped, err := url.PathUnescape(name); err == nil && unescaped != "" {
		name = unescaped
	}
	if name == "" {
		writeError(w, http.StatusBadRequest, "Volume name is required")
		return
	}

	volume, err := h.dockerSvc.InspectVolume(r.Context(), name)
	if err != nil {
		writeError(w, http.StatusNotFound, "Volume not found: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, volume)
}

func (h *APIHandler) CreateVolume(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service not connected")
		return
	}

	var req models.CreateVolumeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "Volume name is required")
		return
	}

	vol, err := h.dockerSvc.CreateVolume(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create volume: "+err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, vol)
}

func (h *APIHandler) DeleteVolume(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service not connected")
		return
	}

	name := chi.URLParam(r, "name")
	if unescaped, err := url.PathUnescape(name); err == nil && unescaped != "" {
		name = unescaped
	}
	if name == "" {
		writeError(w, http.StatusBadRequest, "Volume name is required")
		return
	}

	force := r.URL.Query().Get("force") == "true"
	if err := h.dockerSvc.RemoveVolume(r.Context(), name, force); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to delete volume: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Volume deleted successfully"})
}

func (h *APIHandler) PruneVolumes(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service not connected")
		return
	}

	report, err := h.dockerSvc.PruneVolumes(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to prune volumes: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, report)
}

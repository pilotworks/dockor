package handlers

import (
	"encoding/json"
	"net/http"
	"net/url"

	"github.com/go-chi/chi/v5"
	"github.com/pilotworks/dockor/internal/models"
)

func (h *APIHandler) ListImages(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service not connected")
		return
	}

	images, err := h.dockerSvc.ListImages(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to list images: "+err.Error())
		return
	}
	if images == nil {
		images = []models.ImageSummaryItem{}
	}
	writeJSON(w, http.StatusOK, images)
}

func (h *APIHandler) GetImage(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service not connected")
		return
	}

	id := chi.URLParam(r, "id")
	if unescaped, err := url.PathUnescape(id); err == nil && unescaped != "" {
		id = unescaped
	}
	if id == "" {
		writeError(w, http.StatusBadRequest, "Image ID is required")
		return
	}

	img, err := h.dockerSvc.InspectImage(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "Image not found: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, img)
}

func (h *APIHandler) PullImage(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service not connected")
		return
	}

	var req models.PullImageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Image == "" {
		writeError(w, http.StatusBadRequest, "Image name is required")
		return
	}

	reader, err := h.dockerSvc.PullImage(r.Context(), req.Image)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to pull image: "+err.Error())
		return
	}
	defer reader.Close()

	w.Header().Set("Content-Type", "application/x-ndjson")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)

	flusher, canFlush := w.(http.Flusher)
	buf := make([]byte, 2048)
	for {
		n, readErr := reader.Read(buf)
		if n > 0 {
			_, _ = w.Write(buf[:n])
			if canFlush {
				flusher.Flush()
			}
		}
		if readErr != nil {
			break
		}
	}
}

func (h *APIHandler) DeleteImage(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service not connected")
		return
	}

	id := chi.URLParam(r, "id")
	if unescaped, err := url.PathUnescape(id); err == nil && unescaped != "" {
		id = unescaped
	}
	if id == "" {
		writeError(w, http.StatusBadRequest, "Image ID is required")
		return
	}

	force := r.URL.Query().Get("force") == "true"
	items, err := h.dockerSvc.RemoveImage(r.Context(), id, force)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to remove image: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Image deleted successfully",
		"items":   items,
	})
}

func (h *APIHandler) PruneImages(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service not connected")
		return
	}

	danglingOnly := r.URL.Query().Get("all") != "true"
	report, err := h.dockerSvc.PruneImages(r.Context(), danglingOnly)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to prune images: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, report)
}

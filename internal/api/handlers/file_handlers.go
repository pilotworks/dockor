package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"

	"github.com/go-chi/chi/v5"
	"github.com/pilotworks/dockor/internal/models"
)

// ListContainerFiles lists contents of a directory in the container
func (h *APIHandler) ListContainerFiles(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "docker service not initialized")
		return
	}

	containerID := chi.URLParam(r, "id")
	dirPath := r.URL.Query().Get("path")
	if dirPath == "" {
		dirPath = "/"
	}

	items, err := h.dockerSvc.ListContainerFiles(r.Context(), containerID, dirPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list files: "+err.Error())
		return
	}
	if items == nil {
		items = []models.FileItem{}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"path":  dirPath,
		"items": items,
	})
}

// ReadContainerFile returns text content of a file in the container
func (h *APIHandler) ReadContainerFile(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "docker service not initialized")
		return
	}

	containerID := chi.URLParam(r, "id")
	filePath := r.URL.Query().Get("path")
	if filePath == "" {
		writeError(w, http.StatusBadRequest, "path query parameter is required")
		return
	}

	data, err := h.dockerSvc.ReadContainerFile(r.Context(), containerID, filePath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read file: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"path":    filePath,
		"content": string(data),
		"size":    len(data),
	})
}

// DownloadContainerFile downloads a file as an attachment
func (h *APIHandler) DownloadContainerFile(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "docker service not initialized")
		return
	}

	containerID := chi.URLParam(r, "id")
	filePath := r.URL.Query().Get("path")
	if filePath == "" {
		writeError(w, http.StatusBadRequest, "path query parameter is required")
		return
	}

	data, err := h.dockerSvc.ReadContainerFile(r.Context(), containerID, filePath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read file: "+err.Error())
		return
	}

	filename := filepath.Base(filePath)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(data)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

type WriteFileRequest struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// WriteContainerFile writes string content into a target file path inside container
func (h *APIHandler) WriteContainerFile(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "docker service not initialized")
		return
	}

	containerID := chi.URLParam(r, "id")
	var req WriteFileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	if req.Path == "" {
		writeError(w, http.StatusBadRequest, "path is required")
		return
	}

	if err := h.dockerSvc.WriteContainerFile(r.Context(), containerID, req.Path, []byte(req.Content)); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to write file: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status": "saved",
		"path":   req.Path,
		"size":   len(req.Content),
	})
}

// UploadContainerFile uploads a multipart file into a target directory in the container
func (h *APIHandler) UploadContainerFile(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "docker service not initialized")
		return
	}

	containerID := chi.URLParam(r, "id")
	// 32MB max memory
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "failed to parse multipart form: "+err.Error())
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "file parameter is required: "+err.Error())
		return
	}
	defer file.Close()

	destDir := r.FormValue("path")
	if destDir == "" {
		destDir = "/"
	}

	content, err := io.ReadAll(file)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read uploaded file: "+err.Error())
		return
	}

	targetPath := filepath.ToSlash(filepath.Join(destDir, header.Filename))
	if err := h.dockerSvc.WriteContainerFile(r.Context(), containerID, targetPath, content); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to copy file to container: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":   "uploaded",
		"filename": header.Filename,
		"path":     targetPath,
		"size":     len(content),
	})
}

// DeleteContainerPath deletes a file or directory inside container
func (h *APIHandler) DeleteContainerPath(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "docker service not initialized")
		return
	}

	containerID := chi.URLParam(r, "id")
	targetPath := r.URL.Query().Get("path")
	if targetPath == "" || targetPath == "/" {
		writeError(w, http.StatusBadRequest, "valid path parameter is required (cannot delete root)")
		return
	}

	if err := h.dockerSvc.DeleteContainerPath(r.Context(), containerID, targetPath); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete path: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status": "deleted",
		"path":   targetPath,
	})
}

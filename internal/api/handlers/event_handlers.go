package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/pilotworks/dockor/internal/models"
)

// StreamEvents streams real-time Docker daemon events to client via SSE
func (h *APIHandler) StreamEvents(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "docker service not initialized")
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming unsupported by client")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)

	// Send initial connected comment
	fmt.Fprintf(w, ": connected\n\n")
	flusher.Flush()

	eventsCh, unsubscribe := h.dockerSvc.SubscribeEvents()
	defer unsubscribe()

	keepAliveTicker := time.NewTicker(15 * time.Second)
	defer keepAliveTicker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-keepAliveTicker.C:
			fmt.Fprintf(w, ": ping\n\n")
			flusher.Flush()
		case evt, ok := <-eventsCh:
			if !ok {
				return
			}
			data, err := json.Marshal(evt)
			if err != nil {
				continue
			}
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	}
}

// GetEventHistory returns recent daemon events for audit / activity view
func (h *APIHandler) GetEventHistory(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "docker service not initialized")
		return
	}

	events := h.dockerSvc.GetRecentEvents()
	if events == nil {
		events = []models.DockerDaemonEvent{}
	}

	writeJSON(w, http.StatusOK, events)
}

package handlers

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"sync"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
	"github.com/moby/moby/api/pkg/stdcopy"
)

var wsUpgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		return true // Permissive for local dashboard access & homelab
	},
}

type wsWriter struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

func (w *wsWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	err := w.conn.WriteMessage(websocket.TextMessage, p)
	if err != nil {
		return 0, err
	}
	return len(p), nil
}

type ExecResizeMessage struct {
	Type string `json:"type"`
	Cols uint   `json:"cols"`
	Rows uint   `json:"rows"`
}

// ContainerLogs streams container logs via WebSocket or plain HTTP
func (h *APIHandler) ContainerLogs(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	follow := r.URL.Query().Get("follow") != "false"
	tail := r.URL.Query().Get("tail")
	if tail == "" {
		tail = "200"
	}

	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service unavailable")
		return
	}

	logsReader, err := h.dockerSvc.GetContainerLogs(r.Context(), id, follow, tail)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to get container logs: "+err.Error())
		return
	}
	defer logsReader.Close()

	// Check if client requested WebSocket upgrade
	if websocket.IsWebSocketUpgrade(r) {
		conn, err := wsUpgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("[WS] Upgrade error for container logs: %v", err)
			return
		}
		defer conn.Close()

		writer := &wsWriter{conn: conn}

		// Try demultiplexing with stdcopy (standard for docker non-TTY containers)
		_, err = stdcopy.StdCopy(writer, writer, logsReader)
		if err != nil {
			// In case the container has TTY enabled, Docker sends raw stream
			_, _ = io.Copy(writer, logsReader)
		}
		return
	}

	// Plain HTTP response
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, err = stdcopy.StdCopy(w, w, logsReader)
	if err != nil {
		_, _ = io.Copy(w, logsReader)
	}
}

// ContainerExec establishes an interactive pseudo-terminal via WebSocket
func (h *APIHandler) ContainerExec(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	cmdParam := r.URL.Query().Get("cmd")
	if cmdParam == "" {
		cmdParam = "/bin/sh"
	}

	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service unavailable")
		return
	}

	conn, err := wsUpgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS] Upgrade error for container exec: %v", err)
		return
	}
	defer conn.Close()

	// Create exec instance inside container
	execID, err := h.dockerSvc.ExecCreate(r.Context(), id, []string{cmdParam}, true)
	if err != nil {
		// Fallback to /bin/bash or sh if /bin/sh failed
		if cmdParam == "/bin/sh" {
			execID, err = h.dockerSvc.ExecCreate(r.Context(), id, []string{"/bin/bash"}, true)
			if err != nil {
				execID, err = h.dockerSvc.ExecCreate(r.Context(), id, []string{"sh"}, true)
			}
		}
		if err != nil {
			_ = conn.WriteMessage(websocket.TextMessage, []byte("\r\n\x1b[31m[Dockor] Failed to create exec shell: "+err.Error()+"\x1b[0m\r\n"))
			return
		}
	}

	// Attach to exec session with TTY
	hijacked, err := h.dockerSvc.ExecAttach(r.Context(), execID, true)
	if err != nil {
		_ = conn.WriteMessage(websocket.TextMessage, []byte("\r\n\x1b[31m[Dockor] Failed to attach to container exec: "+err.Error()+"\x1b[0m\r\n"))
		return
	}
	defer hijacked.Close()

	// Goroutine 1: Read from Docker TTY output -> Write to WebSocket
	done := make(chan struct{})
	go func() {
		defer close(done)
		buf := make([]byte, 4096)
		for {
			n, err := hijacked.Reader.Read(buf)
			if n > 0 {
				if wErr := conn.WriteMessage(websocket.BinaryMessage, buf[:n]); wErr != nil {
					return
				}
			}
			if err != nil {
				return
			}
		}
	}()

	// Loop 2: Read from WebSocket -> Write to Docker stdin or handle resize
	for {
		msgType, msg, err := conn.ReadMessage()
		if err != nil {
			break
		}

		if msgType == websocket.TextMessage {
			// Check if message is a resize JSON command
			var resizeMsg ExecResizeMessage
			if err := json.Unmarshal(msg, &resizeMsg); err == nil && resizeMsg.Type == "resize" && resizeMsg.Cols > 0 && resizeMsg.Rows > 0 {
				_ = h.dockerSvc.ExecResize(r.Context(), execID, resizeMsg.Rows, resizeMsg.Cols)
				continue
			}
		}

		// Forward input bytes to container stdin
		if _, err := hijacked.Conn.Write(msg); err != nil {
			break
		}
	}

	<-done
}

package handlers

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"math"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
	"github.com/moby/moby/api/pkg/stdcopy"
	"github.com/moby/moby/api/types/container"
	"github.com/pilotworks/dockor/internal/models"
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
	err := w.conn.WriteMessage(websocket.BinaryMessage, p)
	if err != nil {
		return 0, err
	}
	return len(p), nil
}

type ExecMessage struct {
	Type string `json:"type"`
	Data string `json:"data"`
	Cols uint   `json:"cols"`
	Rows uint   `json:"rows"`
}

type ExecResizeMessage = ExecMessage

// ContainerLogs streams container logs via WebSocket or plain HTTP
func (h *APIHandler) ContainerLogs(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service unavailable")
		return
	}

	id := chi.URLParam(r, "id")
	follow := r.URL.Query().Get("follow") != "false"
	tail := r.URL.Query().Get("tail")
	if tail == "" {
		tail = "200"
	}

	// 1. If client requested WebSocket upgrade, upgrade IMMEDIATELY
	if websocket.IsWebSocketUpgrade(r) {
		conn, err := wsUpgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("[WS] Upgrade error for container logs: %v", err)
			return
		}
		defer conn.Close()

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		// Monitor client disconnect in background
		go func() {
			for {
				if _, _, err := conn.ReadMessage(); err != nil {
					cancel()
					return
				}
			}
		}()

		logsReader, err := h.dockerSvc.GetContainerLogs(ctx, id, follow, tail)
		if err != nil {
			_ = conn.WriteMessage(websocket.TextMessage, []byte("\r\n\x1b[31m[Dockor] Failed to get logs: "+err.Error()+"\x1b[0m\r\n"))
			return
		}
		defer logsReader.Close()

		writer := &wsWriter{conn: conn}

		// Try demultiplexing with stdcopy (standard for docker non-TTY containers)
		_, err = stdcopy.StdCopy(writer, writer, logsReader)
		if err != nil {
			// In case the container has TTY enabled, Docker sends raw stream
			_, _ = io.Copy(writer, logsReader)
		}
		return
	}

	// 2. Plain HTTP response fallback
	logsReader, err := h.dockerSvc.GetContainerLogs(r.Context(), id, follow, tail)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to get container logs: "+err.Error())
		return
	}
	defer logsReader.Close()

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, err = stdcopy.StdCopy(w, w, logsReader)
	if err != nil {
		_, _ = io.Copy(w, logsReader)
	}
}

// ContainerExec establishes an interactive pseudo-terminal via WebSocket
func (h *APIHandler) ContainerExec(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service unavailable")
		return
	}

	id := chi.URLParam(r, "id")
	cmdParam := strings.TrimSpace(r.URL.Query().Get("cmd"))
	if cmdParam == "" {
		cmdParam = "/bin/sh"
	}

	// Upgrade IMMEDIATELY so client receives 101 Switching Protocols
	conn, err := wsUpgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS] Upgrade error for container exec: %v", err)
		return
	}
	defer conn.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Create exec instance inside container
	execID, err := h.dockerSvc.ExecCreate(ctx, id, []string{cmdParam}, true)
	if err != nil {
		// Fallback to /bin/bash or sh if /bin/sh failed
		if cmdParam == "/bin/sh" {
			execID, err = h.dockerSvc.ExecCreate(ctx, id, []string{"/bin/bash"}, true)
			if err != nil {
				execID, err = h.dockerSvc.ExecCreate(ctx, id, []string{"sh"}, true)
			}
		}
		if err != nil {
			_ = conn.WriteMessage(websocket.TextMessage, []byte("\r\n\x1b[31m[Dockor] Failed to create exec shell in container ("+id+"): "+err.Error()+"\x1b[0m\r\n"))
			return
		}
	}

	// Attach to exec session with TTY
	hijacked, err := h.dockerSvc.ExecAttach(ctx, execID, true)
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
			var execMsg ExecMessage
			if err := json.Unmarshal(msg, &execMsg); err == nil {
				if execMsg.Type == "resize" && execMsg.Cols > 0 && execMsg.Rows > 0 {
					_ = h.dockerSvc.ExecResize(ctx, execID, execMsg.Rows, execMsg.Cols)
					continue
				}
				if execMsg.Type == "input" {
					if _, err := hijacked.Conn.Write([]byte(execMsg.Data)); err != nil {
						break
					}
					continue
				}
			}
		}

		// Forward raw bytes (binary message or non-JSON text) to container stdin
		if _, err := hijacked.Conn.Write(msg); err != nil {
			break
		}
	}

	<-done
}

// ContainerStats streams real-time container resource statistics via WebSocket or plain JSON
func (h *APIHandler) ContainerStats(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service unavailable")
		return
	}

	id := chi.URLParam(r, "id")

	// 1. WebSocket Streaming Mode
	if websocket.IsWebSocketUpgrade(r) {
		conn, err := wsUpgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("[WS] Upgrade error for container stats: %v", err)
			return
		}
		defer conn.Close()

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		// Read pump to catch client disconnect
		go func() {
			for {
				if _, _, err := conn.ReadMessage(); err != nil {
					cancel()
					return
				}
			}
		}()

		statsReader, err := h.dockerSvc.GetContainerStats(ctx, id, true)
		if err != nil {
			_ = conn.WriteJSON(map[string]string{"error": "Failed to stream stats: " + err.Error()})
			return
		}
		defer statsReader.Close()

		dec := json.NewDecoder(statsReader)
		var prevStats *container.StatsResponse
		var prevTime time.Time
		var prevRx, prevTx uint64
		var prevRead, prevWrite uint64

		for {
			select {
			case <-ctx.Done():
				return
			default:
			}

			var rawStats container.StatsResponse
			if err := dec.Decode(&rawStats); err != nil {
				if err != io.EOF && ctx.Err() == nil {
					log.Printf("[WS] Error decoding stats for container %s: %v", id, err)
				}
				return
			}

			now := time.Now()
			timeDelta := 1.0
			if !prevTime.IsZero() {
				diff := now.Sub(prevTime).Seconds()
				if diff > 0 {
					timeDelta = diff
				}
			}

			statsData := computeStatsData(&rawStats, prevStats, timeDelta, prevRx, prevTx, prevRead, prevWrite)

			// Update previous values for next delta calculation
			prevStats = &rawStats
			prevTime = now
			prevRx = statsData.NetworkRxBytes
			prevTx = statsData.NetworkTxBytes
			prevRead = statsData.BlockReadBytes
			prevWrite = statsData.BlockWriteBytes

			if err := conn.WriteJSON(statsData); err != nil {
				return
			}
		}
	}

	// 2. Plain HTTP fallback (one-shot snapshot)
	statsReader, err := h.dockerSvc.GetContainerStats(r.Context(), id, false)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to get container stats: "+err.Error())
		return
	}
	defer statsReader.Close()

	var rawStats container.StatsResponse
	if err := json.NewDecoder(statsReader).Decode(&rawStats); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to decode container stats: "+err.Error())
		return
	}

	data := computeStatsData(&rawStats, nil, 0, 0, 0, 0, 0)
	writeJSON(w, http.StatusOK, data)
}

func computeStatsData(raw *container.StatsResponse, prev *container.StatsResponse, timeDelta float64, prevRx, prevTx, prevRead, prevWrite uint64) models.ContainerStatsData {
	data := models.ContainerStatsData{
		Timestamp:   time.Now(),
		MemoryLimit: raw.MemoryStats.Limit,
	}

	// 1. CPU Percentage Calculation
	cpuDelta := float64(raw.CPUStats.CPUUsage.TotalUsage) - float64(raw.PreCPUStats.CPUUsage.TotalUsage)
	systemDelta := float64(raw.CPUStats.SystemUsage) - float64(raw.PreCPUStats.SystemUsage)

	if prev != nil && (cpuDelta <= 0 || systemDelta <= 0) {
		cpuDelta = float64(raw.CPUStats.CPUUsage.TotalUsage) - float64(prev.CPUStats.CPUUsage.TotalUsage)
		systemDelta = float64(raw.CPUStats.SystemUsage) - float64(prev.CPUStats.SystemUsage)
	}

	onlineCPUs := int(raw.CPUStats.OnlineCPUs)
	if onlineCPUs == 0 {
		onlineCPUs = len(raw.CPUStats.CPUUsage.PercpuUsage)
	}
	if onlineCPUs == 0 {
		onlineCPUs = 1
	}
	data.OnlineCPUs = onlineCPUs

	if systemDelta > 0 && cpuDelta > 0 {
		data.CPUPercent = math.Round(((cpuDelta/systemDelta)*float64(onlineCPUs)*100.0)*100) / 100
	}

	// Per-core CPU breakdown
	if len(raw.CPUStats.CPUUsage.PercpuUsage) > 0 && systemDelta > 0 {
		var prevPercpu []uint64
		if len(raw.PreCPUStats.CPUUsage.PercpuUsage) == len(raw.CPUStats.CPUUsage.PercpuUsage) {
			prevPercpu = raw.PreCPUStats.CPUUsage.PercpuUsage
		} else if prev != nil && len(prev.CPUStats.CPUUsage.PercpuUsage) == len(raw.CPUStats.CPUUsage.PercpuUsage) {
			prevPercpu = prev.CPUStats.CPUUsage.PercpuUsage
		}

		if len(prevPercpu) == len(raw.CPUStats.CPUUsage.PercpuUsage) {
			for i, cur := range raw.CPUStats.CPUUsage.PercpuUsage {
				cDelta := float64(cur) - float64(prevPercpu[i])
				if cDelta > 0 {
					corePct := math.Round(((cDelta/systemDelta)*100.0)*10) / 10
					data.PerCPUUsage = append(data.PerCPUUsage, corePct)
				} else {
					data.PerCPUUsage = append(data.PerCPUUsage, 0)
				}
			}
		}
	}

	// 2. Memory Usage & Cache
	var cache uint64
	if val, ok := raw.MemoryStats.Stats["cache"]; ok {
		cache = val
	} else if val, ok := raw.MemoryStats.Stats["inactive_file"]; ok {
		cache = val
	}
	data.MemoryCache = cache

	usedMemory := raw.MemoryStats.Usage
	if usedMemory >= cache {
		usedMemory -= cache
	}
	data.MemoryUsage = usedMemory

	if data.MemoryLimit > 0 {
		data.MemoryPercent = math.Round((float64(usedMemory)/float64(data.MemoryLimit)*100.0)*100) / 100
	}

	// 3. Network I/O
	var totalRx, totalTx uint64
	for _, net := range raw.Networks {
		totalRx += net.RxBytes
		totalTx += net.TxBytes
	}
	data.NetworkRxBytes = totalRx
	data.NetworkTxBytes = totalTx

	if timeDelta > 0 && prevRx > 0 && totalRx >= prevRx {
		data.NetworkRxRate = math.Round((float64(totalRx-prevRx)/timeDelta)*10) / 10
	}
	if timeDelta > 0 && prevTx > 0 && totalTx >= prevTx {
		data.NetworkTxRate = math.Round((float64(totalTx-prevTx)/timeDelta)*10) / 10
	}

	// 4. Block I/O
	var totalRead, totalWrite uint64
	for _, entry := range raw.BlkioStats.IoServiceBytesRecursive {
		switch strings.ToLower(entry.Op) {
		case "read":
			totalRead += entry.Value
		case "write":
			totalWrite += entry.Value
		}
	}
	data.BlockReadBytes = totalRead
	data.BlockWriteBytes = totalWrite

	if timeDelta > 0 && prevRead > 0 && totalRead >= prevRead {
		data.BlockReadRate = math.Round((float64(totalRead-prevRead)/timeDelta)*10) / 10
	}
	if timeDelta > 0 && prevWrite > 0 && totalWrite >= prevWrite {
		data.BlockWriteRate = math.Round((float64(totalWrite-prevWrite)/timeDelta)*10) / 10
	}

	// 5. PIDs count
	data.PidsCount = raw.PidsStats.Current

	return data
}

package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/moby/moby/api/types/network"
	"github.com/pilotworks/dockor/internal/models"
	"github.com/pilotworks/dockor/internal/repository"
	"github.com/pilotworks/dockor/internal/service"
)

type APIHandler struct {
	repo         *repository.Repository
	dockerSvc    *service.DockerService
	templateEng  *service.TemplateEngine
	composeSvc   *service.ComposeService
}

func NewAPIHandler(repo *repository.Repository, dockerSvc *service.DockerService, templateEng *service.TemplateEngine, composeSvc *service.ComposeService) *APIHandler {
	return &APIHandler{
		repo:        repo,
		dockerSvc:   dockerSvc,
		templateEng: templateEng,
		composeSvc:  composeSvc,
	}
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// HealthCheck
func (h *APIHandler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	dockerStatus := "connected"
	if h.dockerSvc == nil || h.dockerSvc.Ping(r.Context()) != nil {
		dockerStatus = "unavailable"
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":  "healthy",
		"version": "0.1.0",
		"docker":  dockerStatus,
	})
}

// Auth Handlers
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (h *APIHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	// Simple MVP authentication: user admin / admin123
	if req.Username == "admin" && req.Password == "admin123" {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"access_token": "dockor_token_" + uuid.New().String(),
			"user": map[string]interface{}{
				"id":       "usr_admin",
				"username": "admin",
				"role":     "admin",
			},
		})
		return
	}

	writeError(w, http.StatusUnauthorized, "Invalid credentials")
}

func (h *APIHandler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":       "usr_admin",
		"username": "admin",
		"role":     "admin",
	})
}

// Template Handlers
func (h *APIHandler) ListTemplates(w http.ResponseWriter, r *http.Request) {
	templates, err := h.templateEng.LoadTemplates()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, templates)
}

func (h *APIHandler) GetTemplate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tmpl, err := h.templateEng.GetTemplateByID(id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, tmpl)
}

type PreviewTemplateRequest struct {
	Variables map[string]interface{} `json:"variables"`
}

func (h *APIHandler) PreviewTemplate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tmpl, err := h.templateEng.GetTemplateByID(id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	var req PreviewTemplateRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	result, err := h.templateEng.Evaluate(tmpl, req.Variables)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, result)
}

// Stack Handlers
func (h *APIHandler) ListStacks(w http.ResponseWriter, r *http.Request) {
	nodeID := r.URL.Query().Get("node_id")
	stacks, err := h.repo.ListStacks(r.Context(), nodeID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if stacks == nil {
		stacks = []models.Stack{}
	}
	writeJSON(w, http.StatusOK, stacks)
}

type DeployStackRequest struct {
	Name        string                 `json:"name"`
	NodeID      string                 `json:"node_id"`
	TemplateID  string                 `json:"template_id,omitempty"`
	ComposeYAML string                 `json:"compose_yaml,omitempty"`
	Variables   map[string]interface{} `json:"variables,omitempty"`
}

func (h *APIHandler) DeployStack(w http.ResponseWriter, r *http.Request) {
	var req DeployStackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "Stack name is required")
		return
	}

	if req.NodeID == "" {
		req.NodeID = "node_local"
	}

	composeContent := req.ComposeYAML
	if req.TemplateID != "" {
		tmpl, err := h.templateEng.GetTemplateByID(req.TemplateID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Template not found: "+err.Error())
			return
		}
		evalRes, err := h.templateEng.Evaluate(tmpl, req.Variables)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Evaluation error: "+err.Error())
			return
		}
		composeContent = evalRes.RenderedCompose
	}

	envMap := make(map[string]string)
	for k, v := range req.Variables {
		envMap[k] = ""
		if v != nil {
			envMap[k] = fmt.Sprintf("%v", v)
		}
	}

	stack := &models.Stack{
		ID:          "stk_" + uuid.New().String(),
		Name:        req.Name,
		NodeID:      req.NodeID,
		TemplateID:  req.TemplateID,
		ComposeYAML: composeContent,
		EnvVars:     envMap,
		Status:      models.StackStatusDeploying,
	}

	if err := h.repo.CreateStack(r.Context(), stack); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Trigger real compose up via ComposeService
	if h.composeSvc != nil {
		out, err := h.composeSvc.Up(r.Context(), stack)
		if err != nil {
			_ = h.repo.UpdateStackStatus(r.Context(), stack.ID, models.StackStatusError)
			stack.Status = models.StackStatusError
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
				"error":  "Compose deployment failed: " + err.Error(),
				"output": out,
				"stack":  stack,
			})
			return
		}
		_ = h.repo.UpdateStackStatus(r.Context(), stack.ID, models.StackStatusRunning)
		stack.Status = models.StackStatusRunning
	} else {
		stack.Status = models.StackStatusRunning
		_ = h.repo.UpdateStackStatus(r.Context(), stack.ID, models.StackStatusRunning)
	}

	writeJSON(w, http.StatusCreated, stack)
}

func (h *APIHandler) GetStack(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	stack, err := h.repo.GetStack(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if stack == nil {
		writeError(w, http.StatusNotFound, "Stack not found")
		return
	}
	writeJSON(w, http.StatusOK, stack)
}

type UpdateStackRequest struct {
	ComposeYAML string `json:"compose_yaml"`
	Redeploy    bool   `json:"redeploy"`
}

func (h *APIHandler) UpdateStack(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	stack, err := h.repo.GetStack(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if stack == nil {
		writeError(w, http.StatusNotFound, "Stack not found")
		return
	}

	var req UpdateStackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.ComposeYAML != "" {
		stack.ComposeYAML = req.ComposeYAML
	}

	if err := h.repo.UpdateStack(r.Context(), stack); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if req.Redeploy && h.composeSvc != nil {
		out, err := h.composeSvc.Up(r.Context(), stack)
		if err != nil {
			_ = h.repo.UpdateStackStatus(r.Context(), stack.ID, models.StackStatusError)
			stack.Status = models.StackStatusError
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
				"error":  "Failed to redeploy stack: " + err.Error(),
				"output": out,
				"stack":  stack,
			})
			return
		}
		_ = h.repo.UpdateStackStatus(r.Context(), stack.ID, models.StackStatusRunning)
		stack.Status = models.StackStatusRunning
	}

	writeJSON(w, http.StatusOK, stack)
}

func (h *APIHandler) StartStack(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	stack, err := h.repo.GetStack(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if stack == nil {
		writeError(w, http.StatusNotFound, "Stack not found")
		return
	}

	var output string
	if h.composeSvc != nil {
		out, err := h.composeSvc.Start(r.Context(), stack)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to start stack: "+err.Error())
			return
		}
		output = out
	}

	_ = h.repo.UpdateStackStatus(r.Context(), id, models.StackStatusRunning)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Stack started successfully",
		"output":  output,
	})
}

func (h *APIHandler) StopStack(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	stack, err := h.repo.GetStack(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if stack == nil {
		writeError(w, http.StatusNotFound, "Stack not found")
		return
	}

	var output string
	if h.composeSvc != nil {
		out, err := h.composeSvc.Stop(r.Context(), stack)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to stop stack: "+err.Error())
			return
		}
		output = out
	}

	_ = h.repo.UpdateStackStatus(r.Context(), id, models.StackStatusStopped)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Stack stopped successfully",
		"output":  output,
	})
}

func (h *APIHandler) RestartStack(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	stack, err := h.repo.GetStack(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if stack == nil {
		writeError(w, http.StatusNotFound, "Stack not found")
		return
	}

	var output string
	if h.composeSvc != nil {
		out, err := h.composeSvc.Restart(r.Context(), stack)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to restart stack: "+err.Error())
			return
		}
		output = out
	}

	_ = h.repo.UpdateStackStatus(r.Context(), id, models.StackStatusRunning)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Stack restarted successfully",
		"output":  output,
	})
}

func (h *APIHandler) PullStack(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	stack, err := h.repo.GetStack(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if stack == nil {
		writeError(w, http.StatusNotFound, "Stack not found")
		return
	}

	var output string
	if h.composeSvc != nil {
		out, err := h.composeSvc.Pull(r.Context(), stack)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to pull stack images: "+err.Error())
			return
		}
		output = out
		upOut, upErr := h.composeSvc.Up(r.Context(), stack)
		if upErr != nil {
			writeError(w, http.StatusInternalServerError, "Failed to apply pulled stack: "+upErr.Error())
			return
		}
		output += "\n" + upOut
	}

	_ = h.repo.UpdateStackStatus(r.Context(), id, models.StackStatusRunning)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Stack updated successfully",
		"output":  output,
	})
}

func (h *APIHandler) GetStackLogs(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	stack, err := h.repo.GetStack(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if stack == nil {
		writeError(w, http.StatusNotFound, "Stack not found")
		return
	}

	if h.composeSvc == nil {
		writeJSON(w, http.StatusOK, map[string]string{"logs": "Compose service unavailable"})
		return
	}

	logs, err := h.composeSvc.Logs(r.Context(), stack, 150)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to read stack logs: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"logs": logs})
}

func (h *APIHandler) DeleteStack(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	stack, err := h.repo.GetStack(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if stack != nil && h.composeSvc != nil {
		removeVolumes := r.URL.Query().Get("delete_volumes") == "true"
		_, _ = h.composeSvc.Down(r.Context(), stack, removeVolumes)
		_ = h.composeSvc.RemoveStackDir(stack.ID)
	}

	if err := h.repo.DeleteStack(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Stack deleted successfully"})
}

// Container Handlers
func (h *APIHandler) ListContainers(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeJSON(w, http.StatusOK, []interface{}{})
		return
	}

	all := r.URL.Query().Get("all") != "false"
	containers, err := h.dockerSvc.ListContainers(r.Context(), all)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if containers == nil {
		containers = []models.ContainerSummary{}
	}
	writeJSON(w, http.StatusOK, containers)
}

func (h *APIHandler) CreateContainer(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service not connected")
		return
	}

	var req models.CreateContainerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	if req.Image == "" {
		writeError(w, http.StatusBadRequest, "Container image is required")
		return
	}

	res, err := h.dockerSvc.CreateContainer(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create container: "+err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, res)
}

func (h *APIHandler) GetContainer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service not connected")
		return
	}
	inspectRes, err := h.dockerSvc.InspectContainer(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "Container not found: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, inspectRes.Container)
}

func (h *APIHandler) StartContainer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.dockerSvc.StartContainer(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Container started"})
}

func (h *APIHandler) StopContainer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.dockerSvc.StopContainer(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Container stopped"})
}

func (h *APIHandler) RestartContainer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.dockerSvc.RestartContainer(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Container restarted"})
}

func (h *APIHandler) DeleteContainer(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service not connected")
		return
	}
	id := chi.URLParam(r, "id")
	force := r.URL.Query().Get("force") == "true"
	if err := h.dockerSvc.RemoveContainer(r.Context(), id, force); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to remove container: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Container deleted successfully", "status": "deleted"})
}

// Node Handlers
func (h *APIHandler) ListNodes(w http.ResponseWriter, r *http.Request) {
	nodes, err := h.repo.ListNodes(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if nodes == nil {
		nodes = []models.Node{}
	}
	writeJSON(w, http.StatusOK, nodes)
}

// System Handlers
func (h *APIHandler) GetDiskUsage(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service not connected")
		return
	}
	usage, err := h.dockerSvc.GetDiskUsage(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to get disk usage: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, usage)
}

func (h *APIHandler) PruneSystem(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service not connected")
		return
	}

	opts := service.PruneOptions{
		Containers: true,
		Images:     true,
		Volumes:    false,
		Networks:   true,
		BuildCache: true,
	}

	if r.Body != nil && r.ContentLength > 0 {
		_ = json.NewDecoder(r.Body).Decode(&opts)
	}

	result, err := h.dockerSvc.Prune(r.Context(), opts)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Prune failed: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

// Network Handlers
func (h *APIHandler) ListNetworks(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service not connected")
		return
	}
	networks, err := h.dockerSvc.ListNetworks(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if networks == nil {
		networks = []network.Summary{}
	}
	writeJSON(w, http.StatusOK, networks)
}

func (h *APIHandler) GetNetwork(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service not connected")
		return
	}
	id := chi.URLParam(r, "id")
	net, err := h.dockerSvc.InspectNetwork(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, net)
}

func (h *APIHandler) CreateNetwork(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service not connected")
		return
	}
	var req service.CreateNetworkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "Network name is required")
		return
	}
	net, err := h.dockerSvc.CreateNetwork(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, net)
}

func (h *APIHandler) DeleteNetwork(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service not connected")
		return
	}
	id := chi.URLParam(r, "id")
	if err := h.dockerSvc.RemoveNetwork(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

type ConnectNetworkRequest struct {
	ContainerID string `json:"container_id"`
	Force       bool   `json:"force,omitempty"`
}

func (h *APIHandler) ConnectNetwork(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service not connected")
		return
	}
	id := chi.URLParam(r, "id")
	var req ConnectNetworkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ContainerID == "" {
		writeError(w, http.StatusBadRequest, "Container ID is required")
		return
	}
	if err := h.dockerSvc.ConnectNetwork(r.Context(), id, req.ContainerID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "connected"})
}

func (h *APIHandler) DisconnectNetwork(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service not connected")
		return
	}
	id := chi.URLParam(r, "id")
	var req ConnectNetworkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ContainerID == "" {
		writeError(w, http.StatusBadRequest, "Container ID is required")
		return
	}
	if err := h.dockerSvc.DisconnectNetwork(r.Context(), id, req.ContainerID, req.Force); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "disconnected"})
}

// Stack CI/CD Webhook Handlers
func (h *APIHandler) RedeployStackWebhook(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	token := r.URL.Query().Get("token")
	if token == "" {
		token = r.Header.Get("X-Dockor-Token")
	}
	if token == "" {
		auth := r.Header.Get("Authorization")
		if strings.HasPrefix(auth, "Bearer ") {
			token = strings.TrimPrefix(auth, "Bearer ")
		}
	}

	stack, err := h.repo.GetStack(r.Context(), id)
	if err != nil || stack == nil {
		writeError(w, http.StatusNotFound, "Stack not found")
		return
	}

	if stack.WebhookToken == "" || stack.WebhookToken != token {
		writeError(w, http.StatusUnauthorized, "Invalid or missing webhook token")
		return
	}

	// Trigger async redeployment
	go func(stk models.Stack) {
		ctx := context.Background()
		_ = h.repo.UpdateStackStatus(ctx, stk.ID, models.StackStatusDeploying)
		if h.composeSvc != nil {
			_, _ = h.composeSvc.Pull(ctx, &stk)
			_, err := h.composeSvc.Up(ctx, &stk)
			if err != nil {
				_ = h.repo.UpdateStackStatus(ctx, stk.ID, models.StackStatusError)
				return
			}
			_ = h.repo.UpdateStackStatus(ctx, stk.ID, models.StackStatusRunning)
		}
	}(*stack)

	writeJSON(w, http.StatusAccepted, map[string]interface{}{
		"status":  "triggered",
		"message": "Redeploy triggered successfully for stack " + stack.Name,
		"stack":   stack.Name,
	})
}

func (h *APIHandler) RegenerateStackWebhookToken(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	stack, err := h.repo.GetStack(r.Context(), id)
	if err != nil || stack == nil {
		writeError(w, http.StatusNotFound, "Stack not found")
		return
	}

	newToken := strings.ReplaceAll(uuid.New().String(), "-", "")
	if err := h.repo.UpdateStackWebhookToken(r.Context(), id, newToken); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update webhook token: "+err.Error())
		return
	}

	host := r.Host
	if host == "" {
		host = "localhost:9000"
	}
	proto := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		proto = "https"
	}
	webhookURL := fmt.Sprintf("%s://%s/api/v1/stacks/%s/webhook?token=%s", proto, host, id, newToken)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"webhook_token": newToken,
		"webhook_url":   webhookURL,
	})
}

// Node Enrollment & Delete Handlers
func (h *APIHandler) GenerateNodeEnrollment(w http.ResponseWriter, r *http.Request) {
	token := strings.ReplaceAll(uuid.New().String(), "-", "")
	host := r.Host
	if host == "" {
		host = "localhost:9000"
	}
	wsProto := "ws"
	httpProto := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		wsProto = "wss"
		httpProto = "https"
	}

	serverURL := fmt.Sprintf("%s://%s", wsProto, host)
	dockerCmd := fmt.Sprintf("docker run -d --name dockor-agent --restart unless-stopped -v /var/run/docker.sock:/var/run/docker.sock pilotworks/dockor-agent:latest --server %s --token %s", serverURL, token)
	installCmd := fmt.Sprintf("curl -fsSL %s://%s/agent.sh | sh -s -- --token %s --server %s", httpProto, host, token, serverURL)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"token":           token,
		"server_url":      serverURL,
		"docker_command":  dockerCmd,
		"install_command": installCmd,
	})
}

func (h *APIHandler) DeleteNode(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "Node ID is required")
		return
	}
	if err := h.repo.DeleteNode(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to delete node: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// Custom Template & Catalog Import Handlers
func (h *APIHandler) CreateCustomTemplate(w http.ResponseWriter, r *http.Request) {
	var tmpl models.Template
	if err := json.NewDecoder(r.Body).Decode(&tmpl); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid template payload: "+err.Error())
		return
	}

	if strings.TrimSpace(tmpl.Metadata.Name) == "" {
		writeError(w, http.StatusBadRequest, "Template name is required")
		return
	}

	if err := h.templateEng.SaveCustomTemplate(&tmpl); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to save template: "+err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, tmpl)
}

type ImportCatalogRequest struct {
	URL string `json:"url"`
}

func (h *APIHandler) ImportTemplateCatalog(w http.ResponseWriter, r *http.Request) {
	var req ImportCatalogRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.URL == "" {
		writeError(w, http.StatusBadRequest, "Catalog URL is required")
		return
	}

	count, err := h.templateEng.ImportCatalogFromURL(req.URL)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Failed to import catalog: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"imported": count,
		"message":  fmt.Sprintf("Successfully imported %d templates", count),
	})
}

// Container Commit Handler
type CommitContainerRequest struct {
	Repo    string `json:"repo"`
	Tag     string `json:"tag"`
	Comment string `json:"comment,omitempty"`
	Author  string `json:"author,omitempty"`
	Pause   bool   `json:"pause,omitempty"`
}

func (h *APIHandler) CommitContainer(w http.ResponseWriter, r *http.Request) {
	if h.dockerSvc == nil {
		writeError(w, http.StatusServiceUnavailable, "Docker service not connected")
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "Container ID is required")
		return
	}

	var req CommitContainerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Repo == "" {
		writeError(w, http.StatusBadRequest, "Target repository is required")
		return
	}
	if req.Tag == "" {
		req.Tag = "latest"
	}

	reference := fmt.Sprintf("%s:%s", req.Repo, req.Tag)
	imageID, err := h.dockerSvc.CommitContainer(r.Context(), id, reference, req.Comment, req.Author, req.Pause)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to commit container: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"image_id":  imageID,
		"reference": reference,
		"status":    "committed",
	})
}



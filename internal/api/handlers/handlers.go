package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/pilotworks/dockor/internal/models"
	"github.com/pilotworks/dockor/internal/repository"
	"github.com/pilotworks/dockor/internal/service"
)

type APIHandler struct {
	repo         *repository.Repository
	dockerSvc    *service.DockerService
	templateEng  *service.TemplateEngine
}

func NewAPIHandler(repo *repository.Repository, dockerSvc *service.DockerService, templateEng *service.TemplateEngine) *APIHandler {
	return &APIHandler{
		repo:        repo,
		dockerSvc:   dockerSvc,
		templateEng: templateEng,
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
			envMap[k] = v.(string)
		}
	}

	stack := &models.Stack{
		ID:          "stk_" + uuid.New().String(),
		Name:        req.Name,
		NodeID:      req.NodeID,
		TemplateID:  req.TemplateID,
		ComposeYAML: composeContent,
		EnvVars:     envMap,
		Status:      models.StackStatusRunning,
	}

	if err := h.repo.CreateStack(r.Context(), stack); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, stack)
}

func (h *APIHandler) DeleteStack(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
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

	all := r.URL.Query().Get("all") == "true"
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

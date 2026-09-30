package api

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/pilotworks/dockor/internal/api/handlers"
	"github.com/pilotworks/dockor/internal/models"
)

func NewRouter(h *handlers.APIHandler, webDir ...string) http.Handler {
	r := chi.NewRouter()

	// Global Middlewares
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Compress(5, "application/json", "text/html", "text/css", "application/javascript", "text/plain", "application/xml"))

	// Permissive CORS for development
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:3000", "*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-API-Key"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	authMW := Authenticate(h.Repo(), h.JWTSecret())
	adminOnly := RequireRole(models.RoleAdmin)
	devOrAdmin := RequireRole(models.RoleAdmin, models.RoleDeveloper)

	// Public Agent Bootstrap Script
	r.Get("/agent.sh", h.ServeAgentInstallScript)

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/health", h.HealthCheck)

		// Public Auth
		r.Post("/auth/login", h.Login)

		// Public Agent Handshake & Tunnel
		r.Post("/agent/handshake", h.AgentHandshake)
		r.Get("/agent/tunnel", h.AgentTunnel)

		// Public Stack Webhook (redeployment triggered by external CI/CD via token)
		r.Post("/stacks/{id}/webhook", h.RedeployStackWebhook)

		// Authenticated Routes
		r.Group(func(r chi.Router) {
			r.Use(authMW)

			// Current User Auth
			r.Get("/auth/me", h.GetCurrentUser)
			r.Post("/auth/change-password", h.ChangePassword)

			// Users Management (Admin Only)
			r.Route("/users", func(r chi.Router) {
				r.Use(adminOnly)
				r.Get("/", h.ListUsers)
				r.Post("/", h.CreateUser)
				r.Get("/{id}", h.GetUser)
				r.Put("/{id}", h.UpdateUser)
				r.Delete("/{id}", h.DeleteUser)
			})

			// Templates
			r.Route("/templates", func(r chi.Router) {
				r.Get("/", h.ListTemplates)
				r.Get("/{id}", h.GetTemplate)
				r.Post("/{id}/preview", h.PreviewTemplate)
				r.With(devOrAdmin).Post("/", h.CreateCustomTemplate)
				r.With(devOrAdmin).Post("/import-catalog", h.ImportTemplateCatalog)
			})

			// Stacks
			r.Route("/stacks", func(r chi.Router) {
				r.Get("/", h.ListStacks)
				r.Get("/{id}", h.GetStack)
				r.Get("/{id}/logs", h.GetStackLogs)
				r.With(devOrAdmin).Post("/", h.DeployStack)
				r.With(devOrAdmin).Put("/{id}", h.UpdateStack)
				r.With(devOrAdmin).Delete("/{id}", h.DeleteStack)
				r.With(devOrAdmin).Post("/{id}/start", h.StartStack)
				r.With(devOrAdmin).Post("/{id}/stop", h.StopStack)
				r.With(devOrAdmin).Post("/{id}/restart", h.RestartStack)
				r.With(devOrAdmin).Post("/{id}/pull", h.PullStack)
				r.With(devOrAdmin).Post("/{id}/webhook/token", h.RegenerateStackWebhookToken)
			})

			// Containers
			r.Route("/containers", func(r chi.Router) {
				r.Get("/", h.ListContainers)
				r.Get("/{id}", h.GetContainer)
				r.Get("/{id}/logs", h.ContainerLogs)
				r.Get("/{id}/stats", h.ContainerStats)
				r.Get("/{id}/files", h.ListContainerFiles)
				r.Get("/{id}/files/read", h.ReadContainerFile)
				r.Get("/{id}/files/download", h.DownloadContainerFile)

				r.With(devOrAdmin).Post("/", h.CreateContainer)
				r.With(devOrAdmin).Post("/{id}/start", h.StartContainer)
				r.With(devOrAdmin).Post("/{id}/stop", h.StopContainer)
				r.With(devOrAdmin).Post("/{id}/restart", h.RestartContainer)
				r.With(devOrAdmin).Delete("/{id}", h.DeleteContainer)
				r.With(devOrAdmin).Post("/{id}/commit", h.CommitContainer)
				r.With(devOrAdmin).Get("/{id}/exec", h.ContainerExec)
				r.With(devOrAdmin).Post("/{id}/files/write", h.WriteContainerFile)
				r.With(devOrAdmin).Post("/{id}/files/upload", h.UploadContainerFile)
				r.With(devOrAdmin).Delete("/{id}/files", h.DeleteContainerPath)
			})

			// Networks
			r.Route("/networks", func(r chi.Router) {
				r.Get("/", h.ListNetworks)
				r.Get("/{id}", h.GetNetwork)
				r.With(devOrAdmin).Post("/", h.CreateNetwork)
				r.With(devOrAdmin).Delete("/{id}", h.DeleteNetwork)
				r.With(devOrAdmin).Post("/{id}/connect", h.ConnectNetwork)
				r.With(devOrAdmin).Post("/{id}/disconnect", h.DisconnectNetwork)
			})

			// Volumes
			r.Route("/volumes", func(r chi.Router) {
				r.Get("/", h.ListVolumes)
				r.Get("/{name}", h.GetVolume)
				r.With(devOrAdmin).Post("/", h.CreateVolume)
				r.With(devOrAdmin).Post("/prune", h.PruneVolumes)
				r.With(devOrAdmin).Delete("/{name}", h.DeleteVolume)
			})

			// Images
			r.Route("/images", func(r chi.Router) {
				r.Get("/", h.ListImages)
				r.Get("/{id}", h.GetImage)
				r.With(devOrAdmin).Post("/pull", h.PullImage)
				r.With(devOrAdmin).Post("/prune", h.PruneImages)
				r.With(devOrAdmin).Delete("/{id}", h.DeleteImage)
				r.With(devOrAdmin).Post("/{id}/tag", h.TagImage)
				r.With(devOrAdmin).Post("/{id}/push", h.PushImage)
			})

			// Registries
			r.Route("/registries", func(r chi.Router) {
				r.Get("/", h.ListRegistries)
				r.Get("/{id}", h.GetRegistry)
				r.With(adminOnly).Post("/", h.CreateRegistry)
				r.With(adminOnly).Put("/{id}", h.UpdateRegistry)
				r.With(adminOnly).Delete("/{id}", h.DeleteRegistry)
			})

			// Nodes
			r.Route("/nodes", func(r chi.Router) {
				r.Get("/", h.ListNodes)
				r.With(adminOnly).Post("/enrollment-token", h.GenerateNodeEnrollment)
				r.Post("/{id}/ping", h.PingNode)
				r.With(adminOnly).Delete("/{id}", h.DeleteNode)
			})

			// System & Events
			r.Route("/system", func(r chi.Router) {
				r.Get("/df", h.GetDiskUsage)
				r.With(adminOnly).Post("/prune", h.PruneSystem)
			})

			r.Get("/events", h.StreamEvents)
			r.Get("/events/history", h.GetEventHistory)
		})
	})

	// Dedicated /ws route for WebSockets
	r.Route("/ws", func(r chi.Router) {
		r.Use(authMW)
		r.Get("/containers/{id}/logs", h.ContainerLogs)
		r.Get("/containers/{id}/stats", h.ContainerStats)
		r.With(devOrAdmin).Get("/containers/{id}/exec", h.ContainerExec)
	})

	// Mount Static File Server and SPA Fallback if web distribution directory is provided
	if len(webDir) > 0 && webDir[0] != "" {
		SetupSPAHandler(r, webDir[0])
	}

	return r
}

// SetupSPAHandler mounts static assets and provides HTML5 History API fallback to index.html for React SPA
func SetupSPAHandler(r chi.Router, webDir string) {
	if webDir == "" {
		return
	}
	indexPath := filepath.Join(webDir, "index.html")
	if _, err := os.Stat(indexPath); err != nil {
		return
	}

	fs := http.FileServer(http.Dir(webDir))

	r.Get("/*", func(w http.ResponseWriter, req *http.Request) {
		// Never intercept /api or /ws requests with SPA fallback
		if strings.HasPrefix(req.URL.Path, "/api") || strings.HasPrefix(req.URL.Path, "/ws") {
			http.NotFound(w, req)
			return
		}

		relPath := filepath.Clean(strings.TrimPrefix(req.URL.Path, "/"))
		targetPath := filepath.Join(webDir, relPath)

		stat, err := os.Stat(targetPath)
		if err == nil && !stat.IsDir() {
			if strings.HasPrefix(relPath, "assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			} else {
				w.Header().Set("Cache-Control", "no-cache")
			}
			fs.ServeHTTP(w, req)
			return
		}

		// Fallback to index.html for client-side routing
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFile(w, req, indexPath)
	})
}


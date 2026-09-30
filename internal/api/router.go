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
)

func NewRouter(h *handlers.APIHandler, webDir ...string) http.Handler {
	r := chi.NewRouter()

	// Global Middlewares
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// Permissive CORS for development
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:3000", "*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-API-Key"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/health", h.HealthCheck)

		// Auth
		r.Route("/auth", func(r chi.Router) {
			r.Post("/login", h.Login)
			r.Get("/me", h.GetCurrentUser)
		})

		// Templates
		r.Route("/templates", func(r chi.Router) {
			r.Get("/", h.ListTemplates)
			r.Post("/", h.CreateCustomTemplate)
			r.Post("/import-catalog", h.ImportTemplateCatalog)
			r.Get("/{id}", h.GetTemplate)
			r.Post("/{id}/preview", h.PreviewTemplate)
		})

		// Stacks
		r.Route("/stacks", func(r chi.Router) {
			r.Get("/", h.ListStacks)
			r.Post("/", h.DeployStack)
			r.Get("/{id}", h.GetStack)
			r.Put("/{id}", h.UpdateStack)
			r.Delete("/{id}", h.DeleteStack)
			r.Post("/{id}/start", h.StartStack)
			r.Post("/{id}/stop", h.StopStack)
			r.Post("/{id}/restart", h.RestartStack)
			r.Post("/{id}/pull", h.PullStack)
			r.Get("/{id}/logs", h.GetStackLogs)
			r.Post("/{id}/webhook", h.RedeployStackWebhook)
			r.Post("/{id}/webhook/token", h.RegenerateStackWebhookToken)
		})

		// Containers
		r.Route("/containers", func(r chi.Router) {
			r.Get("/", h.ListContainers)
			r.Post("/", h.CreateContainer)
			r.Get("/{id}", h.GetContainer)
			r.Post("/{id}/start", h.StartContainer)
			r.Post("/{id}/stop", h.StopContainer)
			r.Post("/{id}/restart", h.RestartContainer)
			r.Delete("/{id}", h.DeleteContainer)
			r.Post("/{id}/commit", h.CommitContainer)
			r.Get("/{id}/logs", h.ContainerLogs)
			r.Get("/{id}/exec", h.ContainerExec)
			r.Get("/{id}/stats", h.ContainerStats)
			r.Get("/{id}/files", h.ListContainerFiles)
			r.Get("/{id}/files/read", h.ReadContainerFile)
			r.Get("/{id}/files/download", h.DownloadContainerFile)
			r.Post("/{id}/files/write", h.WriteContainerFile)
			r.Post("/{id}/files/upload", h.UploadContainerFile)
			r.Delete("/{id}/files", h.DeleteContainerPath)
		})

		// Networks
		r.Route("/networks", func(r chi.Router) {
			r.Get("/", h.ListNetworks)
			r.Post("/", h.CreateNetwork)
			r.Get("/{id}", h.GetNetwork)
			r.Delete("/{id}", h.DeleteNetwork)
			r.Post("/{id}/connect", h.ConnectNetwork)
			r.Post("/{id}/disconnect", h.DisconnectNetwork)
		})

		// Volumes
		r.Route("/volumes", func(r chi.Router) {
			r.Get("/", h.ListVolumes)
			r.Post("/", h.CreateVolume)
			r.Post("/prune", h.PruneVolumes)
			r.Get("/{name}", h.GetVolume)
			r.Delete("/{name}", h.DeleteVolume)
		})

		// Images
		r.Route("/images", func(r chi.Router) {
			r.Get("/", h.ListImages)
			r.Post("/pull", h.PullImage)
			r.Post("/prune", h.PruneImages)
			r.Get("/{id}", h.GetImage)
			r.Delete("/{id}", h.DeleteImage)
			r.Post("/{id}/tag", h.TagImage)
			r.Post("/{id}/push", h.PushImage)
		})

		// Registries
		r.Route("/registries", func(r chi.Router) {
			r.Get("/", h.ListRegistries)
			r.Post("/", h.CreateRegistry)
			r.Get("/{id}", h.GetRegistry)
			r.Put("/{id}", h.UpdateRegistry)
			r.Delete("/{id}", h.DeleteRegistry)
		})

		// Nodes
		r.Route("/nodes", func(r chi.Router) {
			r.Get("/", h.ListNodes)
			r.Post("/enrollment-token", h.GenerateNodeEnrollment)
			r.Delete("/{id}", h.DeleteNode)
		})

		// System & Events
		r.Route("/system", func(r chi.Router) {
			r.Get("/df", h.GetDiskUsage)
			r.Post("/prune", h.PruneSystem)
		})

		r.Get("/events", h.StreamEvents)
		r.Get("/events/history", h.GetEventHistory)
	})

	// Dedicated /ws route for WebSockets
	r.Route("/ws", func(r chi.Router) {
		r.Get("/containers/{id}/logs", h.ContainerLogs)
		r.Get("/containers/{id}/exec", h.ContainerExec)
		r.Get("/containers/{id}/stats", h.ContainerStats)
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


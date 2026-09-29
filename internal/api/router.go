package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/pilotworks/dockor/internal/api/handlers"
)

func NewRouter(h *handlers.APIHandler) http.Handler {
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
		})

		// Containers
		r.Route("/containers", func(r chi.Router) {
			r.Get("/", h.ListContainers)
			r.Post("/{id}/start", h.StartContainer)
			r.Post("/{id}/stop", h.StopContainer)
			r.Post("/{id}/restart", h.RestartContainer)
			r.Get("/{id}/logs", h.ContainerLogs)
			r.Get("/{id}/exec", h.ContainerExec)
		})

		// Nodes
		r.Route("/nodes", func(r chi.Router) {
			r.Get("/", h.ListNodes)
		})
	})

	// Dedicated /ws route for WebSockets
	r.Route("/ws", func(r chi.Router) {
		r.Get("/containers/{id}/logs", h.ContainerLogs)
		r.Get("/containers/{id}/exec", h.ContainerExec)
	})

	return r
}

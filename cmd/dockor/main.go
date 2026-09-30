package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/pilotworks/dockor/internal/api"
	"github.com/pilotworks/dockor/internal/api/handlers"
	"github.com/pilotworks/dockor/internal/config"
	"github.com/pilotworks/dockor/internal/models"
	"github.com/pilotworks/dockor/internal/repository"
	"github.com/pilotworks/dockor/internal/service"
	"github.com/pilotworks/dockor/internal/version"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	log.Printf("Starting Dockor server v%s (commit: %s, built: %s) on :%d...", version.Version, version.GitCommit, version.BuildDate, cfg.Port)
	log.Printf("Database path: %s", cfg.DBPath)

	// 1. Initialize SQLite Database
	db, err := repository.NewDB(cfg.DBPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	repo := repository.NewRepository(db)
	if err := repo.EnsureDefaultAdmin(ctx); err != nil {
		log.Printf("Warning: failed to ensure default admin user: %v", err)
	}

	// 2. Initialize Docker Client Service & Sync Local Node Info
	dockerSvc, err := service.NewDockerService(cfg.DockerHost)
	var localNode models.Node
	if err != nil {
		log.Printf("Warning: Docker daemon connection failed: %v", err)
		localNode = models.Node{
			ID:            "node_local",
			Name:          "Local Engine",
			Hostname:      "localhost",
			IPAddress:     "127.0.0.1",
			DockerVersion: "unknown",
			Status:        models.NodeStatusOffline,
			IsLocal:       true,
			CPUCores:      0,
			TotalMemory:   0,
			Endpoint:      cfg.DockerHost,
		}
	} else if err := dockerSvc.Ping(ctx); err != nil {
		log.Printf("Warning: Docker ping failed (socket %s might be unavailable): %v", cfg.DockerHost, err)
		localNode = models.Node{
			ID:            "node_local",
			Name:          "Local Engine",
			Hostname:      "localhost",
			IPAddress:     "127.0.0.1",
			DockerVersion: "unavailable",
			Status:        models.NodeStatusOffline,
			IsLocal:       true,
			CPUCores:      0,
			TotalMemory:   0,
			Endpoint:      cfg.DockerHost,
		}
	} else {
		log.Printf("Connected to Docker daemon at %s", cfg.DockerHost)
		daemonInfo, infoErr := dockerSvc.GetDaemonInfo(ctx)
		if infoErr != nil {
			log.Printf("Warning: failed to query daemon info: %v", infoErr)
			localNode = models.Node{
				ID:            "node_local",
				Name:          "Local Engine",
				Hostname:      "localhost",
				IPAddress:     "127.0.0.1",
				DockerVersion: "connected",
				Status:        models.NodeStatusOnline,
				IsLocal:       true,
				Endpoint:      cfg.DockerHost,
			}
		} else {
			name := "Local Engine"
			if daemonInfo.Hostname != "" {
				name = fmt.Sprintf("Local (%s)", daemonInfo.Hostname)
			}
			localNode = models.Node{
				ID:            "node_local",
				Name:          name,
				Hostname:      daemonInfo.Hostname,
				IPAddress:     "127.0.0.1",
				DockerVersion: daemonInfo.ServerVersion,
				Status:        models.NodeStatusOnline,
				IsLocal:       true,
				CPUCores:      daemonInfo.CPUCores,
				TotalMemory:   daemonInfo.TotalMemory,
				Endpoint:      daemonInfo.Endpoint,
			}
			log.Printf("Docker host info: Hostname=%s, OS=%s, Server=%s, CPUs=%d, Memory=%.1f GB, Endpoint=%s",
				daemonInfo.Hostname, daemonInfo.OS, daemonInfo.ServerVersion, daemonInfo.CPUCores,
				float64(daemonInfo.TotalMemory)/(1024*1024*1024), daemonInfo.Endpoint)
		}
	}

	if err := repo.UpsertLocalNode(ctx, &localNode); err != nil {
		log.Printf("Warning: failed to register local node: %v", err)
	}

	// 3. Initialize Template Engine
	templateEng := service.NewTemplateEngine(cfg.TemplatesDir)
	templates, err := templateEng.LoadTemplates()
	if err != nil {
		log.Printf("Warning: failed to load templates: %v", err)
	} else {
		log.Printf("Loaded %d template(s) from %s", len(templates), cfg.TemplatesDir)
	}

	// 4. Initialize Compose Service
	composeSvc := service.NewComposeService(cfg.DockerHost, cfg.DataDir)

	// 5. Initialize HTTP API Handler and Router
	handler := handlers.NewAPIHandler(repo, dockerSvc, templateEng, composeSvc)
	handler.SetSecretKey(cfg.SecretKey)
	handler.SetJWTSecret(cfg.JWTSecret)

	// Start background Docker daemon event monitoring if connected
	if dockerSvc != nil {
		dockerSvc.StartEventMonitoring(ctx)
	}

	if cfg.WebDir != "" {
		log.Printf("Serving web UI from: %s", cfg.WebDir)
	} else {
		log.Println("Notice: No web distribution found in ./web/dist or /app/web/dist (API-only mode)")
	}

	router := api.NewRouter(handler, cfg.WebDir)

	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown handling
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("Dockor server ready and listening on http://localhost:%d", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	<-stop
	log.Println("Shutting down Dockor server gracefully...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Dockor server exited cleanly.")
}

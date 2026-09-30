package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/pilotworks/dockor/internal/agent"
	"github.com/pilotworks/dockor/internal/version"
)

func main() {
	serverURL := flag.String("server", "http://localhost:9000", "Dockor master control plane URL (e.g. http://dockor.internal:9000 or https://dockor.example.com)")
	token := flag.String("token", "", "Agent enrollment token generated from the Dockor Nodes UI")
	nodeName := flag.String("name", "", "Friendly display name for this remote node (defaults to system hostname)")
	dockerHost := flag.String("docker-host", "", "Docker daemon socket or endpoint URL (defaults to auto-detected local socket)")
	intervalSec := flag.Int("interval", agent.DefaultHeartbeatSec, "Telemetry heartbeat reporting interval in seconds")
	insecure := flag.Bool("insecure", false, "Skip TLS certificate verification for self-signed certificates")
	showVersion := flag.Bool("version", false, "Print version information and exit")
	flag.Parse()

	if *showVersion {
		fmt.Printf("dockor-agent v%s (commit: %s, built: %s)\n", version.Version, version.GitCommit, version.BuildDate)
		return
	}

	log.Printf("==================================================")
	log.Printf("  Dockor Remote Node Agent v%s", version.Version)
	log.Printf("==================================================")

	if *token == "" {
		// Also allow reading DOCKOR_AGENT_TOKEN from environment
		if envToken := os.Getenv("DOCKOR_AGENT_TOKEN"); envToken != "" {
			*token = envToken
		} else if envToken := os.Getenv("AGENT_TOKEN"); envToken != "" {
			*token = envToken
		} else {
			log.Fatalf("Fatal error: Enrollment token is required. Pass --token <token> or set DOCKOR_AGENT_TOKEN environment variable.")
		}
	}

	if envServer := os.Getenv("DOCKOR_SERVER_URL"); envServer != "" && *serverURL == "http://localhost:9000" {
		*serverURL = envServer
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	cfg := agent.ClientConfig{
		ServerURL:         *serverURL,
		EnrollmentToken:   *token,
		FriendlyName:      *nodeName,
		DockerHost:        *dockerHost,
		HeartbeatInterval: time.Duration(*intervalSec) * time.Second,
		InsecureSkipTLS:   *insecure,
	}

	client, err := agent.NewAgentClient(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize dockor-agent: %v", err)
	}

	go func() {
		sig := <-stop
		log.Printf("Received signal %v, shutting down dockor-agent...", sig)
		client.Stop()
		cancel()
	}()

	if err := client.Start(ctx); err != nil && err != context.Canceled {
		log.Fatalf("dockor-agent exited with error: %v", err)
	}

	log.Println("dockor-agent terminated cleanly.")
}

package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/pilotworks/dockor/internal/version"
)

func main() {
	serverURL := flag.String("server", "http://localhost:9000", "Dockor master control plane URL")
	token := flag.String("token", "", "Agent enrollment token")
	flag.Parse()

	log.Printf("Starting Dockor Remote Node Agent v%s (commit: %s, built: %s)...", version.Version, version.GitCommit, version.BuildDate)
	log.Printf("Connecting to control plane: %s", *serverURL)
	if *token == "" {
		log.Println("Notice: Running in unauthenticated loopback mode without enrollment token")
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	<-stop
	log.Println("Dockor agent stopping...")
}

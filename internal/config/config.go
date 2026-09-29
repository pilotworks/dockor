package config

import (
	"os"
	"strconv"

	"github.com/pilotworks/dockor/internal/docker"
)

type Config struct {
	Port         int
	DataDir      string
	DBPath       string
	DockerHost   string
	JWTSecret    string
	TemplatesDir string
}

func Load() *Config {
	port := 9000
	if p, err := strconv.Atoi(os.Getenv("DOCKOR_PORT")); err == nil && p > 0 {
		port = p
	}

	dataDir := os.Getenv("DOCKOR_DATA_DIR")
	if dataDir == "" {
		dataDir = "./data"
	}

	dbPath := os.Getenv("DOCKOR_DB_PATH")
	if dbPath == "" {
		dbPath = dataDir + "/dockor.db"
	}

	// Dynamically resolve real active Docker socket (supports colima, docker desktop, orbstack, linux, windows)
	dockerHost := docker.ResolveDockerHost()

	jwtSecret := os.Getenv("DOCKOR_JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "dockor-default-development-secret-change-in-prod"
	}

	templatesDir := os.Getenv("DOCKOR_TEMPLATES_DIR")
	if templatesDir == "" {
		templatesDir = "./templates"
	}

	return &Config{
		Port:         port,
		DataDir:      dataDir,
		DBPath:       dbPath,
		DockerHost:   dockerHost,
		JWTSecret:    jwtSecret,
		TemplatesDir: templatesDir,
	}
}

package config

import (
	"crypto/rand"
	"encoding/hex"
	"os"
	"path/filepath"
	"strconv"

	"github.com/pilotworks/dockor/internal/docker"
)

type Config struct {
	Port             int
	DataDir          string
	DBPath           string
	DockerHost       string
	JWTSecret        string
	TemplatesDir     string
	SecretKey        string
	WebDir           string
	CaddyAdminURL    string
	LetsEncryptEmail string
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

	// Separate encryption key for sensitive credentials (AES-256)
	secretKey := os.Getenv("DOCKOR_SECRET_KEY")
	if secretKey == "" {
		keyFilePath := filepath.Join(dataDir, "dockor.secret.key")
		if content, err := os.ReadFile(keyFilePath); err == nil && len(content) >= 32 {
			secretKey = string(content)
		} else {
			// Generate 32 bytes (256-bit) cryptographically secure key
			b := make([]byte, 32)
			_, _ = rand.Read(b)
			secretKey = hex.EncodeToString(b)
			_ = os.MkdirAll(dataDir, 0700)
			_ = os.WriteFile(keyFilePath, []byte(secretKey), 0600)
		}
	}

	// Resolve Web Distribution directory
	webDir := os.Getenv("DOCKOR_WEB_DIR")
	if webDir == "" {
		candidates := []string{
			"./web/dist",
			"/app/web/dist",
			"../web/dist",
		}
		if exe, err := os.Executable(); err == nil {
			exeDir := filepath.Dir(exe)
			candidates = append(candidates,
				filepath.Join(exeDir, "web", "dist"),
				filepath.Join(exeDir, "dist"),
				filepath.Join(exeDir, "..", "web", "dist"),
			)
		}
		for _, cand := range candidates {
			if stat, err := os.Stat(cand); err == nil && stat.IsDir() {
				if _, err := os.Stat(filepath.Join(cand, "index.html")); err == nil {
					webDir = cand
					break
				}
			}
		}
	}

	caddyAdminURL := os.Getenv("DOCKOR_CADDY_ADMIN_URL")
	if caddyAdminURL == "" {
		caddyAdminURL = "http://localhost:2019"
	}

	letsEncryptEmail := os.Getenv("DOCKOR_LETSENCRYPT_EMAIL")

	return &Config{
		Port:             port,
		DataDir:          dataDir,
		DBPath:           dbPath,
		DockerHost:       dockerHost,
		JWTSecret:        jwtSecret,
		TemplatesDir:     templatesDir,
		SecretKey:        secretKey,
		WebDir:           webDir,
		CaddyAdminURL:    caddyAdminURL,
		LetsEncryptEmail: letsEncryptEmail,
	}
}

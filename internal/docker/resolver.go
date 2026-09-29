package docker

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

type DockerConfig struct {
	CurrentContext string `json:"currentContext"`
}

type ContextMeta struct {
	Endpoints struct {
		Docker struct {
			Host string `json:"Host"`
		} `json:"docker"`
	} `json:"Endpoints"`
}

// ResolveDockerHost determines the real, active Docker daemon socket URL
func ResolveDockerHost() string {
	// 1. Explicit DOCKER_HOST environment variable has highest precedence
	if envHost := os.Getenv("DOCKER_HOST"); envHost != "" {
		return envHost
	}

	homeDir, _ := os.UserHomeDir()

	// 2. Check ~/.docker/config.json for active Docker context (e.g. colima, desktop-linux, default)
	if homeDir != "" {
		configPath := filepath.Join(homeDir, ".docker", "config.json")
		if data, err := os.ReadFile(configPath); err == nil {
			var cfg DockerConfig
			if err := json.Unmarshal(data, &cfg); err == nil && cfg.CurrentContext != "" && cfg.CurrentContext != "default" {
				// Calculate SHA256 of context name used by Docker CLI to store metadata
				h := sha256.Sum256([]byte(cfg.CurrentContext))
				contextHash := hex.EncodeToString(h[:])
				metaPath := filepath.Join(homeDir, ".docker", "contexts", "meta", contextHash, "meta.json")
				if metaData, err := os.ReadFile(metaPath); err == nil {
					var meta ContextMeta
					if err := json.Unmarshal(metaData, &meta); err == nil && meta.Endpoints.Docker.Host != "" {
						host := meta.Endpoints.Docker.Host
						if isSocketAlive(host) || isSocketPresent(host) {
							return host
						}
					}
				}
			}
		}
	}

	// 3. Probe common socket paths by operating system
	candidateSockets := getCandidateSockets(homeDir)
	for _, sock := range candidateSockets {
		if isSocketAlive(sock) {
			return sock
		}
	}

	// 4. Fallback default
	if runtime.GOOS == "windows" {
		return "npipe:////./pipe/docker_engine"
	}
	return "unix:///var/run/docker.sock"
}

func getCandidateSockets(homeDir string) []string {
	var candidates []string

	if runtime.GOOS == "darwin" && homeDir != "" {
		candidates = append(candidates,
			fmt.Sprintf("unix://%s/.colima/default/docker.sock", homeDir),
			fmt.Sprintf("unix://%s/.docker/run/docker.sock", homeDir),
			fmt.Sprintf("unix://%s/.orbstack/run/docker.sock", homeDir),
			"unix:///var/run/docker.sock",
		)
	} else if runtime.GOOS == "linux" {
		uid := os.Getuid()
		candidates = append(candidates,
			"unix:///var/run/docker.sock",
			fmt.Sprintf("unix:///run/user/%d/docker.sock", uid),
		)
	} else if runtime.GOOS == "windows" {
		candidates = append(candidates, "npipe:////./pipe/docker_engine")
	}

	return candidates
}

func isSocketPresent(endpoint string) bool {
	if strings.HasPrefix(endpoint, "unix://") {
		sockPath := strings.TrimPrefix(endpoint, "unix://")
		if fi, err := os.Stat(sockPath); err == nil && (fi.Mode()&os.ModeSocket != 0 || fi.Mode().IsRegular()) {
			return true
		}
	}
	return false
}

func isSocketAlive(endpoint string) bool {
	if strings.HasPrefix(endpoint, "unix://") {
		sockPath := strings.TrimPrefix(endpoint, "unix://")
		if fi, err := os.Stat(sockPath); err == nil && (fi.Mode()&os.ModeSocket != 0 || fi.Mode().IsRegular()) {
			conn, err := net.Dial("unix", sockPath)
			if err == nil {
				_ = conn.Close()
				return true
			}
			// In sandbox or restricted environments, net.Dial can fail with "operation not permitted",
			// but the socket file exists and is designated.
			errMsg := err.Error()
			if strings.Contains(errMsg, "operation not permitted") || strings.Contains(errMsg, "permission denied") {
				return true
			}
		}
	}
	return false
}

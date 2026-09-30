package docker

import (
	"os"
	"strings"
	"testing"
)

func TestResolveDockerHost(t *testing.T) {
	// Test explicit DOCKER_HOST override
	customHost := "tcp://192.168.1.100:2375"
	t.Setenv("DOCKER_HOST", customHost)
	if host := ResolveDockerHost(); host != customHost {
		t.Fatalf("Expected %s, got %s", customHost, host)
	}

	// Test auto-detection with unset DOCKER_HOST
	_ = os.Unsetenv("DOCKER_HOST")
	host := ResolveDockerHost()
	t.Logf("Resolved Docker Host: %s", host)
	if host == "" {
		t.Fatalf("Expected non-empty docker host")
	}
	if !strings.HasPrefix(host, "unix://") && !strings.HasPrefix(host, "npipe://") && !strings.HasPrefix(host, "tcp://") {
		t.Errorf("Expected valid docker host scheme, got: %s", host)
	}
}

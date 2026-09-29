package docker

import (
	"testing"
)

func TestResolveDockerHost(t *testing.T) {
	host := ResolveDockerHost()
	t.Logf("Resolved Docker Host: %s", host)
	if host == "" {
		t.Fatalf("Expected non-empty docker host")
	}
	if host != "unix:///Users/tienpham/.colima/default/docker.sock" {
		t.Errorf("Expected Colima docker socket on this environment, got: %s", host)
	}
}

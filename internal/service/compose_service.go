package service

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/pilotworks/dockor/internal/models"
)

type ComposeService struct {
	dockerHost string
	dataDir    string
}

func NewComposeService(dockerHost, dataDir string) *ComposeService {
	return &ComposeService{
		dockerHost: dockerHost,
		dataDir:    dataDir,
	}
}

func (cs *ComposeService) StackDir(stackID string) string {
	return filepath.Join(cs.dataDir, "stacks", stackID)
}

func (cs *ComposeService) PrepareStackFiles(stack *models.Stack) error {
	if stack == nil || stack.ID == "" {
		return fmt.Errorf("invalid stack: stack and ID must not be empty")
	}

	dir := cs.StackDir(stack.ID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create stack directory %s: %w", dir, err)
	}

	composeFile := filepath.Join(dir, "docker-compose.yml")
	if err := os.WriteFile(composeFile, []byte(stack.ComposeYAML), 0644); err != nil {
		return fmt.Errorf("failed to write docker-compose.yml: %w", err)
	}

	if len(stack.EnvVars) > 0 {
		var envLines []string
		for k, v := range stack.EnvVars {
			cleanVal := strings.ReplaceAll(v, "\r\n", "\n")
			if strings.ContainsAny(cleanVal, " \t\n\"'") {
				escaped := strings.ReplaceAll(cleanVal, "\"", "\\\"")
				envLines = append(envLines, fmt.Sprintf("%s=\"%s\"", k, escaped))
			} else {
				envLines = append(envLines, fmt.Sprintf("%s=%s", k, cleanVal))
			}
		}
		envFile := filepath.Join(dir, ".env")
		if err := os.WriteFile(envFile, []byte(strings.Join(envLines, "\n")), 0644); err != nil {
			return fmt.Errorf("failed to write .env file: %w", err)
		}
	}

	return nil
}

func (cs *ComposeService) RemoveStackDir(stackID string) error {
	dir := cs.StackDir(stackID)
	return os.RemoveAll(dir)
}

func (cs *ComposeService) findBinary() (bin string, isPlugin bool, err error) {
	candidates := []string{"docker"}
	// Extra fallback paths for macOS / Homebrew / standard Linux
	extraDirs := []string{"/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"}
	for _, dir := range extraDirs {
		candidates = append(candidates, filepath.Join(dir, "docker"))
	}

	for _, c := range candidates {
		if path, err := exec.LookPath(c); err == nil {
			return path, true, nil
		}
	}

	// Fallback to standalone docker-compose
	composeCandidates := []string{"docker-compose"}
	for _, dir := range extraDirs {
		composeCandidates = append(composeCandidates, filepath.Join(dir, "docker-compose"))
	}
	for _, c := range composeCandidates {
		if path, err := exec.LookPath(c); err == nil {
			return path, false, nil
		}
	}

	return "", false, fmt.Errorf("docker compose binary not found in PATH")
}

func (cs *ComposeService) runCompose(ctx context.Context, stack *models.Stack, args ...string) (string, error) {
	dir := cs.StackDir(stack.ID)

	bin, isPlugin, err := cs.findBinary()
	if err != nil {
		return "", err
	}

	var cmdArgs []string
	if isPlugin {
		cmdArgs = append(cmdArgs, "compose")
	}
	cmdArgs = append(cmdArgs, "-p", stack.Name)
	cmdArgs = append(cmdArgs, args...)

	cmd := exec.CommandContext(ctx, bin, cmdArgs...)
	cmd.Dir = dir

	env := os.Environ()
	if cs.dockerHost != "" {
		env = append(env, fmt.Sprintf("DOCKER_HOST=%s", cs.dockerHost))
	}
	cmd.Env = env

	out, err := cmd.CombinedOutput()
	outputStr := string(out)
	if err != nil {
		return outputStr, fmt.Errorf("compose command failed (%s): %s", err, outputStr)
	}

	return outputStr, nil
}

func (cs *ComposeService) Up(ctx context.Context, stack *models.Stack) (string, error) {
	if err := cs.PrepareStackFiles(stack); err != nil {
		return "", err
	}
	return cs.runCompose(ctx, stack, "-f", "docker-compose.yml", "up", "-d", "--remove-orphans")
}

func (cs *ComposeService) Down(ctx context.Context, stack *models.Stack, removeVolumes bool) (string, error) {
	args := []string{"-f", "docker-compose.yml", "down", "--remove-orphans"}
	if removeVolumes {
		args = append(args, "-v")
	}
	return cs.runCompose(ctx, stack, args...)
}

func (cs *ComposeService) Start(ctx context.Context, stack *models.Stack) (string, error) {
	return cs.runCompose(ctx, stack, "-f", "docker-compose.yml", "start")
}

func (cs *ComposeService) Stop(ctx context.Context, stack *models.Stack) (string, error) {
	return cs.runCompose(ctx, stack, "-f", "docker-compose.yml", "stop")
}

func (cs *ComposeService) Restart(ctx context.Context, stack *models.Stack) (string, error) {
	return cs.runCompose(ctx, stack, "-f", "docker-compose.yml", "restart")
}

func (cs *ComposeService) Pull(ctx context.Context, stack *models.Stack) (string, error) {
	return cs.runCompose(ctx, stack, "-f", "docker-compose.yml", "pull")
}

func (cs *ComposeService) Logs(ctx context.Context, stack *models.Stack, tail int) (string, error) {
	if tail <= 0 {
		tail = 100
	}
	return cs.runCompose(ctx, stack, "-f", "docker-compose.yml", "logs", fmt.Sprintf("--tail=%d", tail), "--no-color")
}

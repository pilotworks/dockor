package service

import (
	"context"
	"fmt"
	"io"

	"github.com/moby/moby/client"
	"github.com/pilotworks/dockor/internal/models"
)

type DaemonInfo struct {
	Hostname      string `json:"hostname"`
	ServerVersion string `json:"server_version"`
	APIVersion    string `json:"api_version"`
	OS            string `json:"os"`
	Arch          string `json:"arch"`
	CPUCores      int    `json:"cpu_cores"`
	TotalMemory   int64  `json:"total_memory"`
	Endpoint      string `json:"endpoint"`
}

type DockerService struct {
	cli *client.Client
}

func NewDockerService(dockerHost string) (*DockerService, error) {
	opts := []client.Opt{
		client.WithHost(dockerHost),
		client.WithAPIVersionNegotiation(),
	}

	cli, err := client.NewClientWithOpts(opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create moby client: %w", err)
	}

	return &DockerService{cli: cli}, nil
}

func (ds *DockerService) Ping(ctx context.Context) error {
	if ds.cli == nil {
		return fmt.Errorf("docker client not initialized")
	}
	_, err := ds.cli.Ping(ctx, client.PingOptions{})
	return err
}

func (ds *DockerService) GetDaemonInfo(ctx context.Context) (*DaemonInfo, error) {
	if ds.cli == nil {
		return nil, fmt.Errorf("docker client not initialized")
	}

	infoRes, err := ds.cli.Info(ctx, client.InfoOptions{})
	if err != nil {
		return nil, err
	}

	info := infoRes.Info
	endpoint := ds.cli.DaemonHost()

	serverVer := info.ServerVersion
	apiVer := ""
	if verRes, err := ds.cli.ServerVersion(ctx, client.ServerVersionOptions{}); err == nil {
		serverVer = verRes.Version
		apiVer = verRes.APIVersion
	}

	return &DaemonInfo{
		Hostname:      info.Name,
		ServerVersion: serverVer,
		APIVersion:    apiVer,
		OS:            info.OperatingSystem,
		Arch:          info.Architecture,
		CPUCores:      info.NCPU,
		TotalMemory:   info.MemTotal,
		Endpoint:      endpoint,
	}, nil
}

func (ds *DockerService) ListContainers(ctx context.Context, all bool) ([]models.ContainerSummary, error) {
	if ds.cli == nil {
		return nil, fmt.Errorf("docker client not initialized")
	}

	rawList, err := ds.cli.ContainerList(ctx, client.ContainerListOptions{All: all})
	if err != nil {
		return nil, err
	}

	var results []models.ContainerSummary
	for _, c := range rawList.Items {
		var ports []models.ContainerPort
		for _, p := range c.Ports {
			ports = append(ports, models.ContainerPort{
				IP:          p.IP.String(),
				PrivatePort: p.PrivatePort,
				PublicPort:  p.PublicPort,
				Type:        p.Type,
			})
		}

		stackName := ""
		if c.Labels != nil {
			stackName = c.Labels["com.docker.compose.project"]
		}

		results = append(results, models.ContainerSummary{
			ID:        c.ID,
			Names:     c.Names,
			Image:     c.Image,
			ImageID:   c.ImageID,
			Command:   c.Command,
			Created:   c.Created,
			State:     string(c.State),
			Status:    c.Status,
			Ports:     ports,
			StackName: stackName,
		})
	}

	return results, nil
}

func (ds *DockerService) StartContainer(ctx context.Context, id string) error {
	_, err := ds.cli.ContainerStart(ctx, id, client.ContainerStartOptions{})
	return err
}

func (ds *DockerService) StopContainer(ctx context.Context, id string) error {
	stopTimeout := 10
	_, err := ds.cli.ContainerStop(ctx, id, client.ContainerStopOptions{Timeout: &stopTimeout})
	return err
}

func (ds *DockerService) RestartContainer(ctx context.Context, id string) error {
	timeout := 10
	_, err := ds.cli.ContainerRestart(ctx, id, client.ContainerRestartOptions{Timeout: &timeout})
	return err
}

func (ds *DockerService) GetContainerLogs(ctx context.Context, id string, follow bool, tail string) (io.ReadCloser, error) {
	if ds.cli == nil {
		return nil, fmt.Errorf("docker client not initialized")
	}
	if tail == "" {
		tail = "150"
	}
	opts := client.ContainerLogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     follow,
		Tail:       tail,
		Timestamps: true,
	}
	return ds.cli.ContainerLogs(ctx, id, opts)
}

func (ds *DockerService) ExecCreate(ctx context.Context, id string, cmd []string, tty bool) (string, error) {
	if ds.cli == nil {
		return "", fmt.Errorf("docker client not initialized")
	}
	if len(cmd) == 0 {
		cmd = []string{"/bin/sh"}
	}
	opts := client.ExecCreateOptions{
		AttachStdin:  true,
		AttachStdout: true,
		AttachStderr: true,
		TTY:          tty,
		Cmd:          cmd,
	}
	res, err := ds.cli.ExecCreate(ctx, id, opts)
	if err != nil {
		return "", err
	}
	return res.ID, nil
}

func (ds *DockerService) ExecAttach(ctx context.Context, execID string, tty bool) (client.HijackedResponse, error) {
	if ds.cli == nil {
		return client.HijackedResponse{}, fmt.Errorf("docker client not initialized")
	}
	opts := client.ExecAttachOptions{
		TTY: tty,
	}
	res, err := ds.cli.ExecAttach(ctx, execID, opts)
	if err != nil {
		return client.HijackedResponse{}, err
	}
	return res.HijackedResponse, nil
}

func (ds *DockerService) ExecResize(ctx context.Context, execID string, height, width uint) error {
	if ds.cli == nil {
		return fmt.Errorf("docker client not initialized")
	}
	opts := client.ExecResizeOptions{
		Height: height,
		Width:  width,
	}
	_, err := ds.cli.ExecResize(ctx, execID, opts)
	return err
}

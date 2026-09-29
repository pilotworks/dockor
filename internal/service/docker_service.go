package service

import (
	"context"
	"fmt"

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

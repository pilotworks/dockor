package service

import (
	"archive/tar"
	"bytes"
	"context"
	"fmt"
	"io"
	"net/netip"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/moby/moby/api/types/container"
	"github.com/moby/moby/api/types/image"
	"github.com/moby/moby/api/types/network"
	"github.com/moby/moby/api/types/volume"
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
	cli          *client.Client
	eventMu      sync.RWMutex
	recentEvents []models.DockerDaemonEvent
	subscribers  map[chan models.DockerDaemonEvent]struct{}
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

	return &DockerService{
		cli:         cli,
		subscribers: make(map[chan models.DockerDaemonEvent]struct{}),
	}, nil
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

func (ds *DockerService) CreateContainer(ctx context.Context, req models.CreateContainerRequest) (*models.CreateContainerResponse, error) {
	if ds.cli == nil {
		return nil, fmt.Errorf("docker client not initialized")
	}

	exposedPorts := network.PortSet{}
	portBindings := network.PortMap{}
	for _, p := range req.Ports {
		if p.ContainerPort == "" {
			continue
		}
		proto := strings.ToLower(p.Protocol)
		if proto != "udp" {
			proto = "tcp"
		}
		portKey, err := network.ParsePort(fmt.Sprintf("%s/%s", p.ContainerPort, proto))
		if err != nil {
			continue
		}
		exposedPorts[portKey] = struct{}{}
		if p.HostPort != "" {
			portBindings[portKey] = []network.PortBinding{
				{
					HostIP:   netip.IPv4Unspecified(),
					HostPort: p.HostPort,
				},
			}
		}
	}

	binds := make([]string, 0, len(req.Volumes))
	for _, v := range req.Volumes {
		if v.Source == "" || v.Destination == "" {
			continue
		}
		mode := v.Mode
		if mode == "" {
			mode = "rw"
		}
		binds = append(binds, fmt.Sprintf("%s:%s:%s", v.Source, v.Destination, mode))
	}

	restartPolicy := container.RestartPolicy{
		Name: container.RestartPolicyMode(req.RestartPolicy),
	}
	if req.RestartPolicy == "" {
		restartPolicy.Name = container.RestartPolicyDisabled
	}

	hostConfig := &container.HostConfig{
		PortBindings:  portBindings,
		Binds:         binds,
		RestartPolicy: restartPolicy,
		AutoRemove:    req.AutoRemove,
	}
	if req.Network != "" {
		hostConfig.NetworkMode = container.NetworkMode(req.Network)
	}

	config := &container.Config{
		Image:        req.Image,
		Cmd:          req.Cmd,
		Env:          req.Env,
		Labels:       req.Labels,
		ExposedPorts: exposedPorts,
	}

	var netConfig *network.NetworkingConfig
	if req.Network != "" && req.Network != "bridge" && req.Network != "default" && req.Network != "host" {
		netConfig = &network.NetworkingConfig{
			EndpointsConfig: map[string]*network.EndpointSettings{
				req.Network: {},
			},
		}
	}

	res, err := ds.cli.ContainerCreate(ctx, client.ContainerCreateOptions{
		Name:             req.Name,
		Config:           config,
		HostConfig:       hostConfig,
		NetworkingConfig: netConfig,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create container: %w", err)
	}

	if req.Start {
		if _, err := ds.cli.ContainerStart(ctx, res.ID, client.ContainerStartOptions{}); err != nil {
			return &models.CreateContainerResponse{
				ID:       res.ID,
				Warnings: append(res.Warnings, "Created but failed to start: "+err.Error()),
			}, nil
		}
	}

	return &models.CreateContainerResponse{
		ID:       res.ID,
		Warnings: res.Warnings,
	}, nil
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

func (ds *DockerService) RemoveContainer(ctx context.Context, id string, force bool) error {
	if ds.cli == nil {
		return fmt.Errorf("docker client not initialized")
	}
	_, err := ds.cli.ContainerRemove(ctx, id, client.ContainerRemoveOptions{
		Force:         force,
		RemoveVolumes: false,
	})
	return err
}

func (ds *DockerService) InspectContainer(ctx context.Context, id string) (client.ContainerInspectResult, error) {
	if ds.cli == nil {
		return client.ContainerInspectResult{}, fmt.Errorf("docker client not initialized")
	}
	return ds.cli.ContainerInspect(ctx, id, client.ContainerInspectOptions{})
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

func (ds *DockerService) GetContainerStats(ctx context.Context, id string, stream bool) (io.ReadCloser, error) {
	if ds.cli == nil {
		return nil, fmt.Errorf("docker client not initialized")
	}
	opts := client.ContainerStatsOptions{
		Stream: stream,
	}
	res, err := ds.cli.ContainerStats(ctx, id, opts)
	if err != nil {
		return nil, err
	}
	return res.Body, nil
}

type DiskUsageCategory struct {
	TotalCount  int64 `json:"total_count"`
	ActiveCount int64 `json:"active_count"`
	TotalSize   int64 `json:"total_size"`
	Reclaimable int64 `json:"reclaimable"`
}

type SystemDiskUsage struct {
	Images           DiskUsageCategory `json:"images"`
	Containers       DiskUsageCategory `json:"containers"`
	Volumes          DiskUsageCategory `json:"volumes"`
	BuildCache       DiskUsageCategory `json:"build_cache"`
	TotalSize        int64             `json:"total_size"`
	TotalReclaimable int64             `json:"total_reclaimable"`
}

type PruneOptions struct {
	Containers bool `json:"containers"`
	Images     bool `json:"images"`
	Volumes    bool `json:"volumes"`
	Networks   bool `json:"networks"`
	BuildCache bool `json:"build_cache"`
}

type PruneResult struct {
	ContainersDeleted int64 `json:"containers_deleted"`
	ImagesDeleted     int64 `json:"images_deleted"`
	VolumesDeleted    int64 `json:"volumes_deleted"`
	NetworksDeleted   int64 `json:"networks_deleted"`
	BuildCacheDeleted int64 `json:"build_cache_deleted"`
	SpaceReclaimed    int64 `json:"space_reclaimed"`
}

func (ds *DockerService) GetDiskUsage(ctx context.Context) (*SystemDiskUsage, error) {
	if ds.cli == nil {
		return nil, fmt.Errorf("docker client not initialized")
	}

	res, err := ds.cli.DiskUsage(ctx, client.DiskUsageOptions{})
	if err != nil {
		return nil, err
	}

	usage := &SystemDiskUsage{
		Images: DiskUsageCategory{
			TotalCount:  res.Images.TotalCount,
			ActiveCount: res.Images.ActiveCount,
			TotalSize:   res.Images.TotalSize,
			Reclaimable: res.Images.Reclaimable,
		},
		Containers: DiskUsageCategory{
			TotalCount:  res.Containers.TotalCount,
			ActiveCount: res.Containers.ActiveCount,
			TotalSize:   res.Containers.TotalSize,
			Reclaimable: res.Containers.Reclaimable,
		},
		Volumes: DiskUsageCategory{
			TotalCount:  res.Volumes.TotalCount,
			ActiveCount: res.Volumes.ActiveCount,
			TotalSize:   res.Volumes.TotalSize,
			Reclaimable: res.Volumes.Reclaimable,
		},
		BuildCache: DiskUsageCategory{
			TotalCount:  res.BuildCache.TotalCount,
			ActiveCount: res.BuildCache.ActiveCount,
			TotalSize:   res.BuildCache.TotalSize,
			Reclaimable: res.BuildCache.Reclaimable,
		},
	}

	usage.TotalSize = usage.Images.TotalSize + usage.Containers.TotalSize + usage.Volumes.TotalSize + usage.BuildCache.TotalSize
	usage.TotalReclaimable = usage.Images.Reclaimable + usage.Containers.Reclaimable + usage.Volumes.Reclaimable + usage.BuildCache.Reclaimable

	return usage, nil
}

func (ds *DockerService) Prune(ctx context.Context, opts PruneOptions) (*PruneResult, error) {
	if ds.cli == nil {
		return nil, fmt.Errorf("docker client not initialized")
	}

	result := &PruneResult{}

	// 1. Containers
	if opts.Containers {
		if cRes, err := ds.cli.ContainerPrune(ctx, client.ContainerPruneOptions{}); err == nil {
			result.ContainersDeleted = int64(len(cRes.Report.ContainersDeleted))
			result.SpaceReclaimed += int64(cRes.Report.SpaceReclaimed)
		}
	}

	// 2. Images
	if opts.Images {
		if iRes, err := ds.cli.ImagePrune(ctx, client.ImagePruneOptions{}); err == nil {
			result.ImagesDeleted = int64(len(iRes.Report.ImagesDeleted))
			result.SpaceReclaimed += int64(iRes.Report.SpaceReclaimed)
		}
	}

	// 3. Volumes
	if opts.Volumes {
		if vRes, err := ds.cli.VolumePrune(ctx, client.VolumePruneOptions{}); err == nil {
			result.VolumesDeleted = int64(len(vRes.Report.VolumesDeleted))
			result.SpaceReclaimed += int64(vRes.Report.SpaceReclaimed)
		}
	}

	// 4. Networks
	if opts.Networks {
		if nRes, err := ds.cli.NetworkPrune(ctx, client.NetworkPruneOptions{}); err == nil {
			result.NetworksDeleted = int64(len(nRes.Report.NetworksDeleted))
		}
	}

	// 5. Build Cache
	if opts.BuildCache {
		if bRes, err := ds.cli.BuildCachePrune(ctx, client.BuildCachePruneOptions{All: true}); err == nil {
			result.BuildCacheDeleted = int64(len(bRes.Report.CachesDeleted))
			result.SpaceReclaimed += int64(bRes.Report.SpaceReclaimed)
		}
	}

	return result, nil
}

type CreateNetworkRequest struct {
	Name       string            `json:"name"`
	Driver     string            `json:"driver"`
	Subnet     string            `json:"subnet,omitempty"`
	Gateway    string            `json:"gateway,omitempty"`
	IPRange    string            `json:"ip_range,omitempty"`
	Internal   bool              `json:"internal"`
	Attachable bool              `json:"attachable"`
	Labels     map[string]string `json:"labels,omitempty"`
	Options    map[string]string `json:"options,omitempty"`
}

func (ds *DockerService) ListNetworks(ctx context.Context) ([]network.Summary, error) {
	res, err := ds.cli.NetworkList(ctx, client.NetworkListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list networks: %w", err)
	}
	return res.Items, nil
}

func (ds *DockerService) InspectNetwork(ctx context.Context, id string) (*network.Inspect, error) {
	res, err := ds.cli.NetworkInspect(ctx, id, client.NetworkInspectOptions{Verbose: true})
	if err != nil {
		return nil, fmt.Errorf("failed to inspect network %s: %w", id, err)
	}
	return &res.Network, nil
}

func (ds *DockerService) CreateNetwork(ctx context.Context, req CreateNetworkRequest) (*network.Inspect, error) {
	opts := client.NetworkCreateOptions{
		Driver:     req.Driver,
		Internal:   req.Internal,
		Attachable: req.Attachable,
		Labels:     req.Labels,
		Options:    req.Options,
	}

	if req.Driver == "" {
		opts.Driver = "bridge"
	}

	if req.Subnet != "" || req.Gateway != "" {
		ipamConfig := network.IPAMConfig{}
		if req.Subnet != "" {
			if prefix, err := netip.ParsePrefix(req.Subnet); err == nil {
				ipamConfig.Subnet = prefix
			}
		}
		if req.Gateway != "" {
			if addr, err := netip.ParseAddr(req.Gateway); err == nil {
				ipamConfig.Gateway = addr
			}
		}
		if req.IPRange != "" {
			if prefix, err := netip.ParsePrefix(req.IPRange); err == nil {
				ipamConfig.IPRange = prefix
			}
		}
		opts.IPAM = &network.IPAM{
			Config: []network.IPAMConfig{ipamConfig},
		}
	}

	res, err := ds.cli.NetworkCreate(ctx, req.Name, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to create network: %w", err)
	}

	return ds.InspectNetwork(ctx, res.ID)
}

func (ds *DockerService) RemoveNetwork(ctx context.Context, id string) error {
	_, err := ds.cli.NetworkRemove(ctx, id, client.NetworkRemoveOptions{})
	if err != nil {
		return fmt.Errorf("failed to remove network %s: %w", id, err)
	}
	return nil
}

func (ds *DockerService) ConnectNetwork(ctx context.Context, networkID string, containerID string) error {
	_, err := ds.cli.NetworkConnect(ctx, networkID, client.NetworkConnectOptions{
		Container: containerID,
	})
	if err != nil {
		return fmt.Errorf("failed to connect container %s to network %s: %w", containerID, networkID, err)
	}
	return nil
}

func (ds *DockerService) DisconnectNetwork(ctx context.Context, networkID string, containerID string, force bool) error {
	_, err := ds.cli.NetworkDisconnect(ctx, networkID, client.NetworkDisconnectOptions{
		Container: containerID,
		Force:     force,
	})
	if err != nil {
		return fmt.Errorf("failed to disconnect container %s from network %s: %w", containerID, networkID, err)
	}
	return nil
}

// Volume Operations

func (ds *DockerService) ListVolumes(ctx context.Context) ([]models.VolumeSummary, error) {
	if ds.cli == nil {
		return nil, fmt.Errorf("docker client not initialized")
	}

	volRes, err := ds.cli.VolumeList(ctx, client.VolumeListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list volumes: %w", err)
	}

	// Fetch containers to map mounted volumes
	volToContainers := make(map[string][]models.VolumeContainer)
	if contList, err := ds.cli.ContainerList(ctx, client.ContainerListOptions{All: true}); err == nil {
		for _, c := range contList.Items {
			name := c.ID
			if len(c.Names) > 0 {
				name = strings.TrimPrefix(c.Names[0], "/")
			}
			for _, m := range c.Mounts {
				if m.Type == "volume" && m.Name != "" {
					volToContainers[m.Name] = append(volToContainers[m.Name], models.VolumeContainer{
						ID:          c.ID,
						Name:        name,
						State:       string(c.State),
						Destination: m.Destination,
						Mode:        m.Mode,
						RW:          m.RW,
					})
				}
			}
		}
	}

	summaries := make([]models.VolumeSummary, 0, len(volRes.Items))
	for _, v := range volRes.Items {
		mounted := volToContainers[v.Name]
		if mounted == nil {
			mounted = []models.VolumeContainer{}
		}

		var usage *models.VolumeUsageData
		if v.UsageData != nil {
			usage = &models.VolumeUsageData{
				RefCount: v.UsageData.RefCount,
				Size:     v.UsageData.Size,
			}
		}

		summaries = append(summaries, models.VolumeSummary{
			Name:       v.Name,
			Driver:     v.Driver,
			Scope:      v.Scope,
			Mountpoint: v.Mountpoint,
			CreatedAt:  v.CreatedAt,
			Labels:     v.Labels,
			Options:    v.Options,
			Status:     v.Status,
			UsageData:  usage,
			Containers: mounted,
			InUse:      len(mounted) > 0,
		})
	}

	sort.Slice(summaries, func(i, j int) bool {
		return summaries[i].Name < summaries[j].Name
	})

	return summaries, nil
}

func (ds *DockerService) InspectVolume(ctx context.Context, name string) (*models.VolumeSummary, error) {
	if ds.cli == nil {
		return nil, fmt.Errorf("docker client not initialized")
	}

	res, err := ds.cli.VolumeInspect(ctx, name, client.VolumeInspectOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to inspect volume %s: %w", name, err)
	}

	v := res.Volume
	var mounted []models.VolumeContainer
	if contList, err := ds.cli.ContainerList(ctx, client.ContainerListOptions{All: true}); err == nil {
		for _, c := range contList.Items {
			cName := c.ID
			if len(c.Names) > 0 {
				cName = strings.TrimPrefix(c.Names[0], "/")
			}
			for _, m := range c.Mounts {
				if m.Type == "volume" && m.Name == name {
					mounted = append(mounted, models.VolumeContainer{
						ID:          c.ID,
						Name:        cName,
						State:       string(c.State),
						Destination: m.Destination,
						Mode:        m.Mode,
						RW:          m.RW,
					})
				}
			}
		}
	}
	if mounted == nil {
		mounted = []models.VolumeContainer{}
	}

	var usage *models.VolumeUsageData
	if v.UsageData != nil {
		usage = &models.VolumeUsageData{
			RefCount: v.UsageData.RefCount,
			Size:     v.UsageData.Size,
		}
	}

	return &models.VolumeSummary{
		Name:       v.Name,
		Driver:     v.Driver,
		Scope:      v.Scope,
		Mountpoint: v.Mountpoint,
		CreatedAt:  v.CreatedAt,
		Labels:     v.Labels,
		Options:    v.Options,
		Status:     v.Status,
		UsageData:  usage,
		Containers: mounted,
		InUse:      len(mounted) > 0,
	}, nil
}

func (ds *DockerService) CreateVolume(ctx context.Context, req models.CreateVolumeRequest) (*volume.Volume, error) {
	if ds.cli == nil {
		return nil, fmt.Errorf("docker client not initialized")
	}

	driver := req.Driver
	if driver == "" {
		driver = "local"
	}

	opts := client.VolumeCreateOptions{
		Name:       req.Name,
		Driver:     driver,
		DriverOpts: req.DriverOpts,
		Labels:     req.Labels,
	}

	res, err := ds.cli.VolumeCreate(ctx, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to create volume: %w", err)
	}

	return &res.Volume, nil
}

func (ds *DockerService) RemoveVolume(ctx context.Context, name string, force bool) error {
	if ds.cli == nil {
		return fmt.Errorf("docker client not initialized")
	}
	_, err := ds.cli.VolumeRemove(ctx, name, client.VolumeRemoveOptions{Force: force})
	if err != nil {
		return fmt.Errorf("failed to remove volume %s: %w", name, err)
	}
	return nil
}

func (ds *DockerService) PruneVolumes(ctx context.Context) (*volume.PruneReport, error) {
	if ds.cli == nil {
		return nil, fmt.Errorf("docker client not initialized")
	}
	res, err := ds.cli.VolumePrune(ctx, client.VolumePruneOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to prune volumes: %w", err)
	}
	return &res.Report, nil
}

// Image Operations

func (ds *DockerService) ListImages(ctx context.Context) ([]models.ImageSummaryItem, error) {
	if ds.cli == nil {
		return nil, fmt.Errorf("docker client not initialized")
	}

	imgRes, err := ds.cli.ImageList(ctx, client.ImageListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list images: %w", err)
	}

	// Map container to image ID / Image string
	imageToContainers := make(map[string][]models.ImageContainerRef)
	if contList, err := ds.cli.ContainerList(ctx, client.ContainerListOptions{All: true}); err == nil {
		for _, c := range contList.Items {
			cName := c.ID
			if len(c.Names) > 0 {
				cName = strings.TrimPrefix(c.Names[0], "/")
			}
			ref := models.ImageContainerRef{
				ID:    c.ID,
				Name:  cName,
				State: string(c.State),
			}
			if c.ImageID != "" {
				imageToContainers[c.ImageID] = append(imageToContainers[c.ImageID], ref)
			}
			if c.Image != "" {
				imageToContainers[c.Image] = append(imageToContainers[c.Image], ref)
			}
		}
	}

	summaries := make([]models.ImageSummaryItem, 0, len(imgRes.Items))
	for _, img := range imgRes.Items {
		shortID := img.ID
		if strings.HasPrefix(shortID, "sha256:") {
			shortID = strings.TrimPrefix(shortID, "sha256:")
		}
		if len(shortID) > 12 {
			shortID = shortID[:12]
		}

		usedMap := make(map[string]models.ImageContainerRef)
		if list, ok := imageToContainers[img.ID]; ok {
			for _, item := range list {
				usedMap[item.ID] = item
			}
		}
		for _, tag := range img.RepoTags {
			if list, ok := imageToContainers[tag]; ok {
				for _, item := range list {
					usedMap[item.ID] = item
				}
			}
		}

		usedBy := make([]models.ImageContainerRef, 0, len(usedMap))
		for _, item := range usedMap {
			usedBy = append(usedBy, item)
		}

		inUse := len(usedBy) > 0 || img.Containers > 0

		summaries = append(summaries, models.ImageSummaryItem{
			ID:          img.ID,
			ShortID:     shortID,
			RepoTags:    img.RepoTags,
			RepoDigests: img.RepoDigests,
			Created:     img.Created,
			Size:        img.Size,
			SharedSize:  img.SharedSize,
			Labels:      img.Labels,
			Containers:  int64(len(usedBy)),
			InUse:       inUse,
			UsedBy:      usedBy,
		})
	}

	// Sort newest first
	sort.Slice(summaries, func(i, j int) bool {
		return summaries[i].Created > summaries[j].Created
	})

	return summaries, nil
}

func (ds *DockerService) InspectImage(ctx context.Context, id string) (*image.InspectResponse, error) {
	if ds.cli == nil {
		return nil, fmt.Errorf("docker client not initialized")
	}

	res, err := ds.cli.ImageInspect(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to inspect image %s: %w", id, err)
	}
	return &res.InspectResponse, nil
}

func (ds *DockerService) PullImage(ctx context.Context, imageRef string) (io.ReadCloser, error) {
	if ds.cli == nil {
		return nil, fmt.Errorf("docker client not initialized")
	}

	res, err := ds.cli.ImagePull(ctx, imageRef, client.ImagePullOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to pull image %s: %w", imageRef, err)
	}
	return res, nil
}

func (ds *DockerService) RemoveImage(ctx context.Context, id string, force bool) ([]image.DeleteResponse, error) {
	if ds.cli == nil {
		return nil, fmt.Errorf("docker client not initialized")
	}

	res, err := ds.cli.ImageRemove(ctx, id, client.ImageRemoveOptions{
		Force:         force,
		PruneChildren: true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to remove image %s: %w", id, err)
	}
	return res.Items, nil
}

func (ds *DockerService) PruneImages(ctx context.Context, danglingOnly bool) (*image.PruneReport, error) {
	if ds.cli == nil {
		return nil, fmt.Errorf("docker client not initialized")
	}

	res, err := ds.cli.ImagePrune(ctx, client.ImagePruneOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to prune images: %w", err)
	}
	return &res.Report, nil
}

func (ds *DockerService) TagImage(ctx context.Context, imageID, targetRepoTag string) error {
	if ds.cli == nil {
		return fmt.Errorf("docker client not initialized")
	}

	_, err := ds.cli.ImageTag(ctx, client.ImageTagOptions{
		Source: imageID,
		Target: targetRepoTag,
	})
	if err != nil {
		return fmt.Errorf("failed to tag image: %w", err)
	}
	return nil
}

func (ds *DockerService) CommitContainer(ctx context.Context, containerID, reference, comment, author string, pause bool) (string, error) {
	if ds.cli == nil {
		return "", fmt.Errorf("docker client not initialized")
	}

	res, err := ds.cli.ContainerCommit(ctx, containerID, client.ContainerCommitOptions{
		Reference: reference,
		Comment:   comment,
		Author:    author,
		NoPause:   !pause,
	})
	if err != nil {
		return "", fmt.Errorf("failed to commit container: %w", err)
	}
	return res.ID, nil
}

func (ds *DockerService) PushImage(ctx context.Context, target string, authHeader string) (io.ReadCloser, error) {
	if ds.cli == nil {
		return nil, fmt.Errorf("docker client not initialized")
	}

	res, err := ds.cli.ImagePush(ctx, target, client.ImagePushOptions{
		RegistryAuth: authHeader,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to push image: %w", err)
	}
	return res, nil
}

// Event Monitoring & History with resilient reconnect loop
func (ds *DockerService) StartEventMonitoring(ctx context.Context) {
	if ds.cli == nil {
		return
	}

	go func() {
		backoff := 1 * time.Second
		for {
			select {
			case <-ctx.Done():
				return
			default:
			}

			res := ds.cli.Events(ctx, client.EventsListOptions{})
			connected := true

			for connected {
				select {
				case <-ctx.Done():
					return
				case err := <-res.Err:
					if err != nil {
						connected = false
					}
				case msg, ok := <-res.Messages:
					if !ok {
						connected = false
						break
					}
					backoff = 1 * time.Second // Reset backoff on successful message
					name := ""
					if msg.Actor.Attributes != nil {
						name = msg.Actor.Attributes["name"]
					}
					evt := models.DockerDaemonEvent{
						Type:       string(msg.Type),
						Action:     string(msg.Action),
						ActorID:    msg.Actor.ID,
						ActorName:  name,
						Attributes: msg.Actor.Attributes,
						Timestamp:  msg.Time,
					}
					ds.recordEvent(evt)
				}
			}

			// Backoff before reconnecting
			select {
			case <-ctx.Done():
				return
			case <-time.After(backoff):
				backoff *= 2
				if backoff > 30*time.Second {
					backoff = 30 * time.Second
				}
			}
		}
	}()
}

func (ds *DockerService) recordEvent(evt models.DockerDaemonEvent) {
	ds.eventMu.Lock()
	defer ds.eventMu.Unlock()

	ds.recentEvents = append(ds.recentEvents, evt)
	if len(ds.recentEvents) > 100 {
		ds.recentEvents = ds.recentEvents[len(ds.recentEvents)-100:]
	}

	for ch := range ds.subscribers {
		select {
		case ch <- evt:
		default:
		}
	}
}

func (ds *DockerService) GetRecentEvents() []models.DockerDaemonEvent {
	ds.eventMu.RLock()
	defer ds.eventMu.RUnlock()

	out := make([]models.DockerDaemonEvent, len(ds.recentEvents))
	copy(out, ds.recentEvents)
	return out
}

func (ds *DockerService) SubscribeEvents() (chan models.DockerDaemonEvent, func()) {
	ch := make(chan models.DockerDaemonEvent, 32)
	ds.eventMu.Lock()
	if ds.subscribers == nil {
		ds.subscribers = make(map[chan models.DockerDaemonEvent]struct{})
	}
	ds.subscribers[ch] = struct{}{}
	ds.eventMu.Unlock()

	unsubscribe := func() {
		ds.eventMu.Lock()
		delete(ds.subscribers, ch)
		close(ch)
		ds.eventMu.Unlock()
	}
	return ch, unsubscribe
}

// Container File Management
func (ds *DockerService) ListContainerFiles(ctx context.Context, containerID, dirPath string) ([]models.FileItem, error) {
	if ds.cli == nil {
		return nil, fmt.Errorf("docker client not initialized")
	}
	if dirPath == "" {
		dirPath = "/"
	}
	if !strings.HasPrefix(dirPath, "/") {
		dirPath = "/" + dirPath
	}

	// Try exec ls -lap first if container is running
	execID, err := ds.ExecCreate(ctx, containerID, []string{"/bin/sh", "-c", fmt.Sprintf("ls -lap %q", dirPath)}, false)
	if err != nil {
		execID, err = ds.ExecCreate(ctx, containerID, []string{"ls", "-lap", dirPath}, false)
	}

	if err == nil {
		hijacked, err := ds.ExecAttach(ctx, execID, false)
		if err == nil {
			defer hijacked.Close()
			outBytes, _ := io.ReadAll(hijacked.Reader)
			lines := strings.Split(string(outBytes), "\n")
			var items []models.FileItem

			for _, line := range lines {
				line = strings.TrimSpace(line)
				if line == "" || strings.HasPrefix(line, "total ") {
					continue
				}
				fields := strings.Fields(line)
				if len(fields) < 8 {
					continue
				}
				nameField := fields[len(fields)-1]
				if nameField == "./" || nameField == "../" || nameField == "." || nameField == ".." {
					continue
				}

				isDir := strings.HasSuffix(nameField, "/")
				cleanName := strings.TrimSuffix(nameField, "/")
				mode := fields[0]
				if strings.HasPrefix(mode, "d") {
					isDir = true
				}
				isSymlink := strings.HasPrefix(mode, "l")
				size := int64(0)
				fmt.Sscanf(fields[4], "%d", &size)

				itemPath := "/" + filepath.ToSlash(filepath.Join(strings.Trim(dirPath, "/"), cleanName))

				items = append(items, models.FileItem{
					Name:      cleanName,
					Path:      itemPath,
					IsDir:     isDir,
					Size:      size,
					Mode:      mode,
					ModTime:   time.Now(),
					IsSymlink: isSymlink,
				})
			}

			if len(items) > 0 {
				sort.Slice(items, func(i, j int) bool {
					if items[i].IsDir != items[j].IsDir {
						return items[i].IsDir
					}
					return items[i].Name < items[j].Name
				})
				return items, nil
			}
		}
	}

	// Fallback to CopyFromContainer which works on distroless or stopped containers
	res, err := ds.cli.CopyFromContainer(ctx, containerID, client.CopyFromContainerOptions{
		SourcePath: dirPath,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to access directory: %w", err)
	}
	defer res.Content.Close()

	tr := tar.NewReader(res.Content)
	var items []models.FileItem
	cleanDir := strings.Trim(dirPath, "/")

	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			break
		}

		hdrName := strings.Trim(hdr.Name, "/")
		if hdrName == cleanDir || hdrName == "" || hdrName == "." {
			continue
		}

		rel := strings.TrimPrefix(hdrName, cleanDir)
		rel = strings.TrimPrefix(rel, "/")
		parts := strings.Split(rel, "/")
		if len(parts) > 1 && (len(parts) > 2 || parts[1] != "") {
			continue
		}

		itemName := parts[0]
		if itemName == "" || itemName == "." || itemName == ".." {
			continue
		}

		itemPath := "/" + filepath.ToSlash(filepath.Join(cleanDir, itemName))
		isDir := hdr.FileInfo().IsDir()
		isSymlink := hdr.Typeflag == tar.TypeSymlink

		items = append(items, models.FileItem{
			Name:       itemName,
			Path:       itemPath,
			IsDir:      isDir,
			Size:       hdr.Size,
			Mode:       hdr.FileInfo().Mode().String(),
			ModTime:    hdr.ModTime,
			IsSymlink:  isSymlink,
			LinkTarget: hdr.Linkname,
		})
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].IsDir != items[j].IsDir {
			return items[i].IsDir
		}
		return items[i].Name < items[j].Name
	})

	return items, nil
}

func (ds *DockerService) ReadContainerFile(ctx context.Context, containerID, filePath string) ([]byte, error) {
	if ds.cli == nil {
		return nil, fmt.Errorf("docker client not initialized")
	}

	res, err := ds.cli.CopyFromContainer(ctx, containerID, client.CopyFromContainerOptions{
		SourcePath: filePath,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}
	defer res.Content.Close()

	tr := tar.NewReader(res.Content)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		if hdr.FileInfo().IsDir() {
			continue
		}

		// Read up to 10MB
		maxLimit := io.LimitReader(tr, 10*1024*1024)
		return io.ReadAll(maxLimit)
	}

	return nil, fmt.Errorf("file not found in archive")
}

func (ds *DockerService) WriteContainerFile(ctx context.Context, containerID, targetPath string, content []byte) error {
	if ds.cli == nil {
		return fmt.Errorf("docker client not initialized")
	}

	dir := filepath.ToSlash(filepath.Dir(targetPath))
	filename := filepath.Base(targetPath)

	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)

	hdr := &tar.Header{
		Name:    filename,
		Mode:    0644,
		Size:    int64(len(content)),
		ModTime: time.Now(),
	}

	if err := tw.WriteHeader(hdr); err != nil {
		return fmt.Errorf("failed to write tar header: %w", err)
	}
	if _, err := tw.Write(content); err != nil {
		return fmt.Errorf("failed to write tar content: %w", err)
	}
	if err := tw.Close(); err != nil {
		return fmt.Errorf("failed to finalize tar archive: %w", err)
	}

	_, err := ds.cli.CopyToContainer(ctx, containerID, client.CopyToContainerOptions{
		DestinationPath: dir,
		Content:         bytes.NewReader(buf.Bytes()),
	})
	if err != nil {
		return fmt.Errorf("failed to copy file to container: %w", err)
	}
	return nil
}

func (ds *DockerService) DeleteContainerPath(ctx context.Context, containerID, targetPath string) error {
	if ds.cli == nil {
		return fmt.Errorf("docker client not initialized")
	}

	execID, err := ds.ExecCreate(ctx, containerID, []string{"/bin/sh", "-c", fmt.Sprintf("rm -rf %q", targetPath)}, false)
	if err != nil {
		execID, err = ds.ExecCreate(ctx, containerID, []string{"rm", "-rf", targetPath}, false)
	}
	if err != nil {
		return fmt.Errorf("failed to create delete command: %w", err)
	}

	hijacked, err := ds.ExecAttach(ctx, execID, false)
	if err != nil {
		return fmt.Errorf("failed to execute delete command: %w", err)
	}
	defer hijacked.Close()

	_, _ = io.ReadAll(hijacked.Reader)
	return nil
}




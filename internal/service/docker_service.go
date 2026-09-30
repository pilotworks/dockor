package service

import (
	"context"
	"fmt"
	"io"
	"net/netip"
	"sort"
	"strings"

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



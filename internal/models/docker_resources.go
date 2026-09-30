package models

type VolumeUsageData struct {
	RefCount int64 `json:"ref_count"`
	Size     int64 `json:"size"`
}

type VolumeContainer struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	State       string `json:"state"`
	Destination string `json:"destination"`
	Mode        string `json:"mode"`
	RW          bool   `json:"rw"`
}

type VolumeSummary struct {
	Name       string            `json:"name"`
	Driver     string            `json:"driver"`
	Scope      string            `json:"scope"`
	Mountpoint string            `json:"mountpoint"`
	CreatedAt  string            `json:"created_at"`
	Labels     map[string]string `json:"labels"`
	Options    map[string]string `json:"options"`
	Status     map[string]any    `json:"status,omitempty"`
	UsageData  *VolumeUsageData  `json:"usage_data,omitempty"`
	Containers []VolumeContainer `json:"containers"`
	InUse      bool              `json:"in_use"`
}

type CreateVolumeRequest struct {
	Name       string            `json:"name"`
	Driver     string            `json:"driver,omitempty"`
	DriverOpts map[string]string `json:"driver_opts,omitempty"`
	Labels     map[string]string `json:"labels,omitempty"`
}

type ImageContainerRef struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	State string `json:"state"`
}

type ImageSummaryItem struct {
	ID          string              `json:"id"`
	ShortID     string              `json:"short_id"`
	RepoTags    []string            `json:"repo_tags"`
	RepoDigests []string            `json:"repo_digests"`
	Created     int64               `json:"created"`
	Size        int64               `json:"size"`
	SharedSize  int64               `json:"shared_size"`
	Labels      map[string]string   `json:"labels"`
	Containers  int64               `json:"containers"`
	InUse       bool                `json:"in_use"`
	UsedBy      []ImageContainerRef `json:"used_by"`
}

type PullImageRequest struct {
	Image string `json:"image"`
}

type PortMapping struct {
	HostPort      string `json:"host_port"`
	ContainerPort string `json:"container_port"`
	Protocol      string `json:"protocol,omitempty"` // "tcp" or "udp"
}

type VolumeMount struct {
	Source      string `json:"source"`
	Destination string `json:"destination"`
	Mode        string `json:"mode,omitempty"` // "rw" or "ro"
}

type CreateContainerRequest struct {
	Name          string            `json:"name,omitempty"`
	Image         string            `json:"image"`
	Cmd           []string          `json:"cmd,omitempty"`
	Env           []string          `json:"env,omitempty"`
	Ports         []PortMapping     `json:"ports,omitempty"`
	Volumes       []VolumeMount     `json:"volumes,omitempty"`
	Network       string            `json:"network,omitempty"`
	RestartPolicy string            `json:"restart_policy,omitempty"` // "no", "always", "unless-stopped", "on-failure"
	AutoRemove    bool              `json:"auto_remove,omitempty"`
	Start         bool              `json:"start,omitempty"`
	Labels        map[string]string `json:"labels,omitempty"`
}

type CreateContainerResponse struct {
	ID       string   `json:"id"`
	Warnings []string `json:"warnings,omitempty"`
}

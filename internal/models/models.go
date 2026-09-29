package models

import (
	"time"
)

type UserRole string

const (
	RoleAdmin     UserRole = "admin"
	RoleDeveloper UserRole = "developer"
	RoleViewer    UserRole = "viewer"
)

type User struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Role         UserRole  `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type NodeStatus string

const (
	NodeStatusOnline       NodeStatus = "online"
	NodeStatusOffline      NodeStatus = "offline"
	NodeStatusDisconnected NodeStatus = "disconnected"
)

type Node struct {
	ID            string     `json:"id"`
	Name          string     `json:"name"`
	Hostname      string     `json:"hostname"`
	IPAddress     string     `json:"ip_address"`
	DockerVersion string     `json:"docker_version"`
	Status        NodeStatus `json:"status"`
	IsLocal       bool       `json:"is_local"`
	CPUCores      int        `json:"cpu_cores"`
	TotalMemory   int64      `json:"total_memory"`
	Endpoint      string     `json:"endpoint,omitempty"`
	LastSeenAt    time.Time  `json:"last_seen_at"`
	CreatedAt     time.Time  `json:"created_at"`
}

type StackStatus string

const (
	StackStatusDeploying StackStatus = "deploying"
	StackStatusRunning   StackStatus = "running"
	StackStatusStopped   StackStatus = "stopped"
	StackStatusError     StackStatus = "error"
	StackStatusUnknown   StackStatus = "unknown"
)

type Stack struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	NodeID      string            `json:"node_id"`
	Status      StackStatus       `json:"status"`
	TemplateID  string            `json:"template_id,omitempty"`
	ComposeYAML string            `json:"compose_yaml"`
	EnvVars     map[string]string `json:"env_vars,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

type Catalog struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	URL          string    `json:"url"`
	Branch       string    `json:"branch"`
	IsOfficial   bool      `json:"is_official"`
	Status       string    `json:"status"`
	LastSyncedAt time.Time `json:"last_synced_at"`
}

type VariableType string

const (
	VarTypeString     VariableType = "string"
	VarTypeNumber     VariableType = "number"
	VarTypeBoolean    VariableType = "boolean"
	VarTypeSelect     VariableType = "select"
	VarTypeSecret     VariableType = "secret"
	VarTypePort       VariableType = "port"
	VarTypeDomain     VariableType = "domain"
	VarTypeVolumePath VariableType = "volume_path"
)

type SelectOption struct {
	Label string `json:"label" yaml:"label"`
	Value string `json:"value" yaml:"value"`
}

type PortConfig struct {
	Protocol            string `json:"protocol,omitempty" yaml:"protocol,omitempty"`
	AutoResolveConflict bool   `json:"auto_resolve_conflict" yaml:"auto_resolve_conflict"`
}

type RoutingConfig struct {
	Enabled       bool   `json:"enabled" yaml:"enabled"`
	TargetService string `json:"target_service" yaml:"target_service"`
	TargetPort    int    `json:"target_port" yaml:"target_port"`
	SSL           string `json:"ssl" yaml:"ssl"`
}

type TemplateVariable struct {
	Name        string         `json:"name" yaml:"name"`
	Label       string         `json:"label" yaml:"label"`
	Type        VariableType   `json:"type" yaml:"type"`
	Default     interface{}    `json:"default,omitempty" yaml:"default,omitempty"`
	Required    bool           `json:"required" yaml:"required"`
	Hidden      bool           `json:"hidden,omitempty" yaml:"hidden,omitempty"`
	Description string         `json:"description,omitempty" yaml:"description,omitempty"`
	Generator   string         `json:"generator,omitempty" yaml:"generator,omitempty"`
	Options     []SelectOption `json:"options,omitempty" yaml:"options,omitempty"`
	PortConfig  *PortConfig    `json:"port_config,omitempty" yaml:"port_config,omitempty"`
	Routing     *RoutingConfig `json:"routing,omitempty" yaml:"routing,omitempty"`
}

type TemplateMetadata struct {
	ID                string   `json:"id" yaml:"id"`
	Name              string   `json:"name" yaml:"name"`
	Version           string   `json:"version" yaml:"version"`
	Description       string   `json:"description" yaml:"description"`
	Category          string   `json:"category" yaml:"category"`
	Tags              []string `json:"tags" yaml:"tags"`
	Author            string   `json:"author" yaml:"author"`
	Icon              string   `json:"icon" yaml:"icon"`
	Website           string   `json:"website" yaml:"website"`
	Documentation     string   `json:"documentation" yaml:"documentation"`
	MinDockorVersion  string   `json:"min_dockor_version" yaml:"min_dockor_version"`
}

type Template struct {
	Metadata    TemplateMetadata    `json:"metadata" yaml:"metadata"`
	Variables   []TemplateVariable  `json:"variables" yaml:"variables"`
	ComposeYAML string              `json:"compose_yaml" yaml:"compose_yaml,omitempty"`
	CatalogID   string              `json:"catalog_id,omitempty"`
	Path        string              `json:"path,omitempty"`
}

type ContainerPort struct {
	IP          string `json:"ip,omitempty"`
	PrivatePort uint16 `json:"private_port"`
	PublicPort  uint16 `json:"public_port,omitempty"`
	Type        string `json:"type"`
}

type ContainerSummary struct {
	ID         string          `json:"id"`
	Names      []string        `json:"names"`
	Image      string          `json:"image"`
	ImageID    string          `json:"image_id"`
	Command    string          `json:"command"`
	Created    int64           `json:"created"`
	State      string          `json:"state"`
	Status     string          `json:"status"`
	Ports      []ContainerPort `json:"ports"`
	StackName  string          `json:"stack_name,omitempty"`
}

type ContainerStatsData struct {
	Timestamp       time.Time `json:"timestamp"`
	CPUPercent      float64   `json:"cpu_percent"`
	PerCPUUsage     []float64 `json:"per_cpu_usage,omitempty"`
	OnlineCPUs      int       `json:"online_cpus"`
	MemoryUsage     uint64    `json:"memory_usage"`
	MemoryLimit     uint64    `json:"memory_limit"`
	MemoryPercent   float64   `json:"memory_percent"`
	MemoryCache     uint64    `json:"memory_cache"`
	NetworkRxBytes  uint64    `json:"network_rx_bytes"`
	NetworkTxBytes  uint64    `json:"network_tx_bytes"`
	NetworkRxRate   float64   `json:"network_rx_rate"`
	NetworkTxRate   float64   `json:"network_tx_rate"`
	BlockReadBytes  uint64    `json:"block_read_bytes"`
	BlockWriteBytes uint64    `json:"block_write_bytes"`
	BlockReadRate   float64   `json:"block_read_rate"`
	BlockWriteRate  float64   `json:"block_write_rate"`
	PidsCount       uint64    `json:"pids_count"`
}

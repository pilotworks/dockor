export interface TemplateVariable {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'secret' | 'port' | 'domain' | 'volume_path';
  default?: any;
  required: boolean;
  hidden?: boolean;
  description?: string;
  generator?: string;
  port_config?: {
    protocol?: string;
    auto_resolve_conflict: boolean;
  };
}

export interface TemplateMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  tags?: string[];
  author?: string;
  icon?: string;
  website?: string;
  documentation?: string;
}

export interface Template {
  metadata: TemplateMetadata;
  variables: TemplateVariable[];
  compose_yaml?: string;
  catalog_id?: string;
  path?: string;
}

export interface Stack {
  id: string;
  name: string;
  node_id: string;
  status: 'deploying' | 'running' | 'stopped' | 'error' | 'unknown';
  template_id?: string;
  compose_yaml: string;
  env_vars?: Record<string, string>;
  created_at: string;
  updated_at: string;
}


export interface Container {
  id: string;
  names: string[];
  image: string;
  state: string;
  status: string;
  ports: {
    ip?: string;
    private_port: number;
    public_port?: number;
    type: string;
  }[];
  stack_name?: string;
}

export interface Node {
  id: string;
  name: string;
  hostname: string;
  ip_address: string;
  docker_version: string;
  status: 'online' | 'offline' | 'disconnected';
  is_local: boolean;
  cpu_cores: number;
  total_memory?: number;
  endpoint?: string;
  last_seen_at: string;
}

export interface ContainerStatsData {
  timestamp: string;
  cpu_percent: number;
  per_cpu_usage?: number[];
  online_cpus: number;
  memory_usage: number;
  memory_limit: number;
  memory_percent: number;
  memory_cache: number;
  network_rx_bytes: number;
  network_tx_bytes: number;
  network_rx_rate: number;
  network_tx_rate: number;
  block_read_bytes: number;
  block_write_bytes: number;
  block_read_rate: number;
  block_write_rate: number;
  pids_count: number;
}

export interface DiskUsageCategory {
  total_count: number;
  active_count: number;
  total_size: number;
  reclaimable: number;
}

export interface SystemDiskUsage {
  images: DiskUsageCategory;
  containers: DiskUsageCategory;
  volumes: DiskUsageCategory;
  build_cache: DiskUsageCategory;
  total_size: number;
  total_reclaimable: number;
}

export interface PruneOptions {
  containers?: boolean;
  images?: boolean;
  volumes?: boolean;
  networks?: boolean;
  build_cache?: boolean;
}

export interface PruneResult {
  containers_deleted: number;
  images_deleted: number;
  volumes_deleted: number;
  networks_deleted: number;
  build_cache_deleted: number;
  space_reclaimed: number;
}

export interface ContainerMount {
  type: string;
  name?: string;
  source: string;
  destination: string;
  driver?: string;
  mode: string;
  rw: boolean;
  propagation?: string;
}

export interface ContainerPortBinding {
  host_ip?: string;
  host_port?: string;
}

export interface ContainerNetworkInfo {
  network_id?: string;
  endpoint_id?: string;
  gateway?: string;
  ip_address: string;
  ip_prefix_len?: number;
  ipv6_gateway?: string;
  global_ipv6_address?: string;
  mac_address: string;
}

export interface ContainerDetailState {
  status: string;
  running: boolean;
  paused: boolean;
  restarting: boolean;
  oom_killed: boolean;
  dead: boolean;
  pid: number;
  exit_code: number;
  error: string;
  started_at: string;
  finished_at: string;
}

export interface ContainerDetail {
  id: string;
  created: string;
  path: string;
  args: string[];
  state: ContainerDetailState;
  image: string;
  name: string;
  restart_count: number;
  driver: string;
  platform: string;
  mounts?: ContainerMount[];
  config: {
    hostname?: string;
    domainname?: string;
    user?: string;
    env?: string[];
    cmd?: string[];
    image?: string;
    working_dir?: string;
    entrypoint?: string[];
    labels?: Record<string, string>;
  };
  network_settings: {
    ip_address?: string;
    gateway?: string;
    mac_address?: string;
    ports?: Record<string, ContainerPortBinding[] | null>;
    networks?: Record<string, ContainerNetworkInfo>;
  };
  host_config?: {
    binds?: string[];
    network_mode?: string;
    restart_policy?: {
      name?: string;
      maximum_retry_count?: number;
    };
    memory?: number;
    nano_cpus?: number;
    cpu_shares?: number;
  };
}

export interface NetworkIPAMConfig {
  Subnet?: string;
  Gateway?: string;
  IPRange?: string;
  AuxiliaryAddresses?: Record<string, string>;
}

export interface NetworkIPAM {
  Driver?: string;
  Options?: Record<string, string>;
  Config?: NetworkIPAMConfig[];
}

export interface NetworkContainerEndpoint {
  Name: string;
  EndpointID: string;
  MacAddress: string;
  IPv4Address: string;
  IPv6Address: string;
}

export interface DockerNetwork {
  Name: string;
  Id: string;
  Created: string;
  Scope: string;
  Driver: string;
  EnableIPv4?: boolean;
  EnableIPv6?: boolean;
  IPAM?: NetworkIPAM;
  Internal: boolean;
  Attachable: boolean;
  Ingress: boolean;
  ConfigFrom?: { Network?: string };
  ConfigOnly?: boolean;
  Containers?: Record<string, NetworkContainerEndpoint>;
  Options?: Record<string, string>;
  Labels?: Record<string, string>;
}

export interface CreateNetworkPayload {
  name: string;
  driver: string;
  subnet?: string;
  gateway?: string;
  ip_range?: string;
  internal?: boolean;
  attachable?: boolean;
  labels?: Record<string, string>;
}

export interface VolumeContainer {
  id: string;
  name: string;
  state: string;
  destination: string;
  mode: string;
  rw: boolean;
}

export interface VolumeUsageData {
  ref_count: number;
  size: number;
}

export interface VolumeSummary {
  name: string;
  driver: string;
  scope: string;
  mountpoint: string;
  created_at: string;
  labels: Record<string, string>;
  options: Record<string, string>;
  status?: Record<string, any>;
  usage_data?: VolumeUsageData;
  containers: VolumeContainer[];
  in_use: boolean;
}

export interface CreateVolumePayload {
  name: string;
  driver?: string;
  driver_opts?: Record<string, string>;
  labels?: Record<string, string>;
}

export interface ImageContainerRef {
  id: string;
  name: string;
  state: string;
}

export interface ImageSummaryItem {
  id: string;
  short_id: string;
  repo_tags: string[];
  repo_digests: string[];
  created: number;
  size: number;
  shared_size: number;
  labels: Record<string, string>;
  containers: number;
  in_use: boolean;
  used_by: ImageContainerRef[];
}

export interface ImageInspectResponse {
  Id: string;
  RepoTags: string[];
  RepoDigests: string[];
  Comment?: string;
  Created: string;
  Author?: string;
  Architecture: string;
  Variant?: string;
  Os: string;
  Size: number;
  Config?: {
    Cmd?: string[];
    Entrypoint?: string[];
    Env?: string[];
    ExposedPorts?: Record<string, any>;
    WorkingDir?: string;
    User?: string;
    Labels?: Record<string, string>;
  };
  RootFS?: {
    Type: string;
    Layers?: string[];
  };
}



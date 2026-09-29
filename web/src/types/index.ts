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

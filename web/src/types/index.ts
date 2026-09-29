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

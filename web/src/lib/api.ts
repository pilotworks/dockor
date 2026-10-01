import {
  Template,
  TemplateListResponse,
  TemplateQueryParams,
  Stack,
  Container,
  Node,
  ContainerDetail,
  ContainerPortBinding,
  ContainerNetworkInfo,
  ContainerMount,
  User,
  LoginPayload,
  LoginResponse,
  ChangePasswordPayload,
  CreateUserPayload,
  UpdateUserPayload,
} from '../types';

const API_BASE = '/api/v1';
const systemFetch = globalThis.fetch;

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem('dockor_token');
  } catch {
    return null;
  }
}

export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init?.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await systemFetch(url, { ...init, headers });
  if (res.status === 401 && !url.includes('/auth/login')) {
    try {
      localStorage.removeItem('dockor_token');
      localStorage.removeItem('dockor_user');
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }
  return res;
}

const fetch = authFetch;

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorBody.error || `HTTP error ${res.status}`);
  }
  return res.json();
}

export function normalizeContainerDetail(raw: any): ContainerDetail {
  if (!raw) return raw;
  const state = raw.state || raw.State || {};
  const config = raw.config || raw.Config || {};
  const networkSettings = raw.network_settings || raw.NetworkSettings || {};
  const hostConfig = raw.host_config || raw.HostConfig || {};

  // Normalize ports
  const rawPorts = networkSettings.ports || networkSettings.Ports || {};
  const ports: Record<string, ContainerPortBinding[] | null> = {};
  for (const [key, val] of Object.entries(rawPorts)) {
    if (Array.isArray(val)) {
      ports[key] = val.map((b: any) => ({
        host_ip: b.host_ip || b.HostIp || '',
        host_port: b.host_port || b.HostPort || '',
      }));
    } else {
      ports[key] = null;
    }
  }

  // Normalize networks
  const rawNetworks = networkSettings.networks || networkSettings.Networks || {};
  const networks: Record<string, ContainerNetworkInfo> = {};
  for (const [netName, netVal] of Object.entries(rawNetworks)) {
    const nv = (netVal || {}) as any;
    networks[netName] = {
      network_id: nv.network_id || nv.NetworkID || '',
      endpoint_id: nv.endpoint_id || nv.EndpointID || '',
      gateway: nv.gateway || nv.Gateway || '',
      ip_address: nv.ip_address || nv.IPAddress || '',
      ip_prefix_len: nv.ip_prefix_len ?? nv.IPPrefixLen ?? 0,
      ipv6_gateway: nv.ipv6_gateway || nv.IPv6Gateway || '',
      global_ipv6_address: nv.global_ipv6_address || nv.GlobalIPv6Address || '',
      mac_address: nv.mac_address || nv.MacAddress || '',
    };
  }

  // Normalize mounts
  const rawMounts = raw.mounts || raw.Mounts || [];
  const mounts: ContainerMount[] = (Array.isArray(rawMounts) ? rawMounts : []).map((m: any) => ({
    type: m.type || m.Type || '',
    name: m.name || m.Name,
    source: m.source || m.Source || '',
    destination: m.destination || m.Destination || '',
    driver: m.driver || m.Driver,
    mode: m.mode || m.Mode || '',
    rw: m.rw ?? m.RW ?? false,
    propagation: m.propagation || m.Propagation,
  }));

  return {
    id: raw.id || raw.Id || raw.ID || '',
    name: raw.name || raw.Name || '',
    created: raw.created || raw.Created || '',
    path: raw.path || raw.Path || '',
    args: raw.args || raw.Args || [],
    image: raw.image || raw.Image || '',
    restart_count: raw.restart_count ?? raw.RestartCount ?? 0,
    driver: raw.driver || raw.Driver || '',
    platform: raw.platform || raw.Platform || '',
    mounts,
    state: {
      status: state.status || state.Status || 'unknown',
      running: Boolean(state.running ?? state.Running ?? false),
      paused: Boolean(state.paused ?? state.Paused ?? false),
      restarting: Boolean(state.restarting ?? state.Restarting ?? false),
      oom_killed: Boolean(state.oom_killed ?? state.OOMKilled ?? false),
      dead: Boolean(state.dead ?? state.Dead ?? false),
      pid: state.pid ?? state.Pid ?? 0,
      exit_code: state.exit_code ?? state.ExitCode ?? 0,
      error: state.error || state.Error || '',
      started_at: state.started_at || state.StartedAt || '',
      finished_at: state.finished_at || state.FinishedAt || '',
    },
    config: {
      hostname: config.hostname || config.Hostname,
      domainname: config.domainname || config.Domainname,
      user: config.user || config.User,
      env: config.env || config.Env || [],
      cmd: config.cmd || config.Cmd || [],
      image: config.image || config.Image || '',
      working_dir: config.working_dir || config.WorkingDir,
      entrypoint: config.entrypoint || config.Entrypoint || [],
      labels: config.labels || config.Labels || {},
    },
    network_settings: {
      ip_address: networkSettings.ip_address || networkSettings.IPAddress || '',
      gateway: networkSettings.gateway || networkSettings.Gateway,
      mac_address: networkSettings.mac_address || networkSettings.MacAddress,
      ports,
      networks,
    },
    host_config: {
      binds: hostConfig.binds || hostConfig.Binds,
      network_mode: hostConfig.network_mode || hostConfig.NetworkMode,
      restart_policy: hostConfig.restart_policy || (hostConfig.RestartPolicy ? {
        name: hostConfig.RestartPolicy.Name,
        maximum_retry_count: hostConfig.RestartPolicy.MaximumRetryCount,
      } : undefined),
      memory: hostConfig.memory ?? hostConfig.Memory,
      nano_cpus: hostConfig.nano_cpus ?? hostConfig.NanoCpus,
      cpu_shares: hostConfig.cpu_shares ?? hostConfig.CpuShares,
    },
  };
}

export const api = {
  getHealth: () => fetch(`${API_BASE}/health`).then(handleResponse<{ status: string; docker: string }>),

  // Templates
  getTemplates: (params?: TemplateQueryParams) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.category && params.category !== 'All') searchParams.set('category', params.category);
    if (params?.search) searchParams.set('search', params.search);
    const qs = searchParams.toString();
    return fetch(`${API_BASE}/templates${qs ? `?${qs}` : ''}`).then(handleResponse<TemplateListResponse>);
  },
  getTemplate: (id: string) => fetch(`${API_BASE}/templates/${id}`).then(handleResponse<Template>),
  previewTemplate: (id: string, variables: Record<string, any>) =>
    fetch(`${API_BASE}/templates/${id}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variables }),
    }).then(handleResponse<{ evaluated_variables: Record<string, any>; warnings: string[]; rendered_compose: string }>),
  createTemplate: (data: any) =>
    fetch(`${API_BASE}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse<any>),
  importCatalog: (url: string) =>
    fetch(`${API_BASE}/templates/import-catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }).then(handleResponse<{ imported: number; message: string }>),

  // Stacks
  getStacks: (nodeId?: string) => {
    const url = nodeId && nodeId !== 'node_local' ? `${API_BASE}/stacks?node_id=${encodeURIComponent(nodeId)}` : `${API_BASE}/stacks`;
    return fetch(url).then(handleResponse<Stack[]>);
  },
  getStack: (id: string) => fetch(`${API_BASE}/stacks/${id}`).then(handleResponse<Stack>),
  deployStack: (data: { name: string; template_id?: string; compose_yaml?: string; variables?: Record<string, any>; node_id?: string }) =>
    fetch(`${API_BASE}/stacks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse<Stack>),
  updateStack: (id: string, data: { compose_yaml: string; redeploy?: boolean }) =>
    fetch(`${API_BASE}/stacks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse<Stack>),
  startStack: (id: string) => fetch(`${API_BASE}/stacks/${id}/start`, { method: 'POST' }).then(handleResponse<{ message: string; output?: string }>),
  stopStack: (id: string) => fetch(`${API_BASE}/stacks/${id}/stop`, { method: 'POST' }).then(handleResponse<{ message: string; output?: string }>),
  restartStack: (id: string) => fetch(`${API_BASE}/stacks/${id}/restart`, { method: 'POST' }).then(handleResponse<{ message: string; output?: string }>),
  pullStack: (id: string) => fetch(`${API_BASE}/stacks/${id}/pull`, { method: 'POST' }).then(handleResponse<{ message: string; output?: string }>),
  getStackLogs: (id: string) => fetch(`${API_BASE}/stacks/${id}/logs`).then(handleResponse<{ logs: string }>),
  deleteStack: (id: string, deleteVolumes = false) =>
    fetch(`${API_BASE}/stacks/${id}?delete_volumes=${deleteVolumes}`, { method: 'DELETE' }).then(handleResponse<{ message: string }>),
  redeployStackWebhook: (id: string, token: string) =>
    fetch(`${API_BASE}/stacks/${id}/webhook?token=${encodeURIComponent(token)}`, { method: 'POST' }).then(handleResponse<{ status: string; message: string }>),
  regenerateStackWebhookToken: (id: string) =>
    fetch(`${API_BASE}/stacks/${id}/webhook/token`, { method: 'POST' }).then(handleResponse<{ webhook_token: string; webhook_url: string }>),

  // Containers
  getContainers: (nodeId?: string) => {
    let url = `${API_BASE}/containers?all=true`;
    if (nodeId && nodeId !== 'node_local') {
      url += `&node_id=${encodeURIComponent(nodeId)}`;
    }
    return fetch(url).then(handleResponse<Container[]>);
  },
  getContainer: (id: string, nodeId?: string) => {
    let url = `${API_BASE}/containers/${id}`;
    if (nodeId && nodeId !== 'node_local') {
      url += `?node_id=${encodeURIComponent(nodeId)}`;
    }
    return fetch(url).then(handleResponse<any>).then(normalizeContainerDetail);
  },
  createContainer: (data: import('../types').CreateContainerPayload) =>
    fetch(`${API_BASE}/containers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse<import('../types').CreateContainerResult>),
  startContainer: (id: string, nodeId?: string) => {
    const q = nodeId && nodeId !== 'node_local' ? `?node_id=${encodeURIComponent(nodeId)}` : '';
    return fetch(`${API_BASE}/containers/${id}/start${q}`, { method: 'POST' });
  },
  stopContainer: (id: string, nodeId?: string) => {
    const q = nodeId && nodeId !== 'node_local' ? `?node_id=${encodeURIComponent(nodeId)}` : '';
    return fetch(`${API_BASE}/containers/${id}/stop${q}`, { method: 'POST' });
  },
  restartContainer: (id: string, nodeId?: string) => {
    const q = nodeId && nodeId !== 'node_local' ? `?node_id=${encodeURIComponent(nodeId)}` : '';
    return fetch(`${API_BASE}/containers/${id}/restart${q}`, { method: 'POST' });
  },
  deleteContainer: (id: string, force = false, nodeId?: string) => {
    let url = `${API_BASE}/containers/${id}?force=${force}`;
    if (nodeId && nodeId !== 'node_local') {
      url += `&node_id=${encodeURIComponent(nodeId)}`;
    }
    return fetch(url, { method: 'DELETE' }).then(handleResponse<{ message: string }>);
  },
  commitContainer: (id: string, data: { repo: string; tag?: string; comment?: string; author?: string; pause?: boolean }) =>
    fetch(`${API_BASE}/containers/${id}/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse<{ image_id: string; reference: string; status: string }>),

  // Nodes
  getNodes: () => fetch(`${API_BASE}/nodes`).then(handleResponse<Node[]>),
  getNodeEnrollment: () =>
    fetch(`${API_BASE}/nodes/enrollment-token`, { method: 'POST' }).then(
      handleResponse<{ token: string; server_url: string; docker_command: string; install_command: string }>
    ),
  pingNode: (id: string) =>
    fetch(`${API_BASE}/nodes/${id}/ping`, { method: 'POST' }).then(
      handleResponse<{ pong: boolean; node_id: string; is_local: boolean; latency_ms: number; details?: any }>
    ),
  deleteNode: (id: string) =>
    fetch(`${API_BASE}/nodes/${id}`, { method: 'DELETE' }).then(handleResponse<{ status: string }>),

  // Networks
  getNetworks: () => fetch(`${API_BASE}/networks`).then(handleResponse<import('../types').DockerNetwork[]>),
  getNetwork: (id: string) => fetch(`${API_BASE}/networks/${id}`).then(handleResponse<import('../types').DockerNetwork>),
  createNetwork: (data: import('../types').CreateNetworkPayload) =>
    fetch(`${API_BASE}/networks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse<import('../types').DockerNetwork>),
  deleteNetwork: (id: string) =>
    fetch(`${API_BASE}/networks/${id}`, { method: 'DELETE' }).then(handleResponse<{ status: string }>),
  connectNetwork: (networkId: string, containerId: string) =>
    fetch(`${API_BASE}/networks/${networkId}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ container_id: containerId }),
    }).then(handleResponse<{ status: string }>),
  disconnectNetwork: (networkId: string, containerId: string, force = false) =>
    fetch(`${API_BASE}/networks/${networkId}/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ container_id: containerId, force }),
    }).then(handleResponse<{ status: string }>),

  // Volumes
  getVolumes: () => fetch(`${API_BASE}/volumes`).then(handleResponse<import('../types').VolumeSummary[]>),
  getVolume: (name: string) => fetch(`${API_BASE}/volumes/${encodeURIComponent(name)}`).then(handleResponse<import('../types').VolumeSummary>),
  createVolume: (data: import('../types').CreateVolumePayload) =>
    fetch(`${API_BASE}/volumes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse<any>),
  deleteVolume: (name: string, force = false) =>
    fetch(`${API_BASE}/volumes/${encodeURIComponent(name)}?force=${force}`, { method: 'DELETE' }).then(handleResponse<{ message: string }>),
  pruneVolumes: () =>
    fetch(`${API_BASE}/volumes/prune`, { method: 'POST' }).then(handleResponse<any>),

  // Images
  getImages: () => fetch(`${API_BASE}/images`).then(handleResponse<import('../types').ImageSummaryItem[]>),
  getImage: (id: string) => fetch(`${API_BASE}/images/${encodeURIComponent(id)}`).then(handleResponse<import('../types').ImageInspectResponse>),
  deleteImage: (id: string, force = false) =>
    fetch(`${API_BASE}/images/${encodeURIComponent(id)}?force=${force}`, { method: 'DELETE' }).then(handleResponse<{ message: string; items: any[] }>),
  pruneImages: (all = false) =>
    fetch(`${API_BASE}/images/prune?all=${all}`, { method: 'POST' }).then(handleResponse<any>),
  tagImage: (id: string, repo: string, tag: string) =>
    fetch(`${API_BASE}/images/${encodeURIComponent(id)}/tag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo, tag }),
    }).then(handleResponse<{ status: string; target: string }>),
  pushImage: async (id: string, tag?: string, auth?: string, onProgress?: (msg: any) => void) => {
    const res = await fetch(`${API_BASE}/images/${encodeURIComponent(id)}/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag, auth }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || 'Failed to push image');
    }
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          onProgress?.(parsed);
        } catch {}
      }
    }
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer);
        onProgress?.(parsed);
      } catch {}
    }
  },
  pullImage: async (image: string, onProgress?: (msg: any) => void) => {
    const res = await fetch(`${API_BASE}/images/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || 'Failed to pull image');
    }
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          onProgress?.(parsed);
        } catch {
          // ignore partial parse error
        }
      }
    }
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer);
        onProgress?.(parsed);
      } catch {
        // ignore
      }
    }
  },

  // System
  getSystemDiskUsage: () =>
    fetch(`${API_BASE}/system/df`).then(handleResponse<import('../types').SystemDiskUsage>),
  pruneSystem: (options?: import('../types').PruneOptions) =>
    fetch(`${API_BASE}/system/prune`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    }).then(handleResponse<import('../types').PruneResult>),

  // Container Files
  getContainerFiles: (id: string, path = '/') =>
    fetch(`${API_BASE}/containers/${encodeURIComponent(id)}/files?path=${encodeURIComponent(path)}`).then(
      handleResponse<import('../types').ContainerFilesResponse>
    ),
  readContainerFile: (id: string, path: string) =>
    fetch(`${API_BASE}/containers/${encodeURIComponent(id)}/files/read?path=${encodeURIComponent(path)}`).then(
      handleResponse<{ path: string; content: string; size: number }>
    ),
  writeContainerFile: (id: string, path: string, content: string) =>
    fetch(`${API_BASE}/containers/${encodeURIComponent(id)}/files/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    }).then(handleResponse<{ status: string; path: string; size: number }>),
  uploadContainerFile: (id: string, path: string, file: File) => {
    const formData = new FormData();
    formData.append('path', path);
    formData.append('file', file);
    return fetch(`${API_BASE}/containers/${encodeURIComponent(id)}/files/upload`, {
      method: 'POST',
      body: formData,
    }).then(handleResponse<{ status: string; filename: string; path: string; size: number }>);
  },
  deleteContainerPath: (id: string, path: string) =>
    fetch(`${API_BASE}/containers/${encodeURIComponent(id)}/files?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
    }).then(handleResponse<{ status: string; path: string }>),
  getContainerFileDownloadUrl: (id: string, path: string) => {
    const token = getAuthToken();
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
    return `${API_BASE}/containers/${encodeURIComponent(id)}/files/download?path=${encodeURIComponent(path)}${tokenParam}`;
  },

  // Registries
  getRegistries: () =>
    fetch(`${API_BASE}/registries`).then(handleResponse<import('../types').Registry[]>),
  getRegistry: (id: string) =>
    fetch(`${API_BASE}/registries/${encodeURIComponent(id)}`).then(handleResponse<import('../types').Registry>),
  createRegistry: (payload: import('../types').CreateRegistryPayload) =>
    fetch(`${API_BASE}/registries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(handleResponse<import('../types').Registry>),
  updateRegistry: (id: string, payload: import('../types').UpdateRegistryPayload) =>
    fetch(`${API_BASE}/registries/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(handleResponse<import('../types').Registry>),
  deleteRegistry: (id: string) =>
    fetch(`${API_BASE}/registries/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).then(handleResponse<{ status: string; id: string }>),

  // Events
  getEventHistory: () =>
    fetch(`${API_BASE}/events/history`).then(handleResponse<import('../types').DockerDaemonEvent[]>),
  getEventStreamUrl: () => {
    const token = getAuthToken();
    return token ? `${API_BASE}/events?token=${encodeURIComponent(token)}` : `${API_BASE}/events`;
  },

  // Auth
  login: (payload: LoginPayload) =>
    fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(handleResponse<LoginResponse>),
  getCurrentUser: () =>
    fetch(`${API_BASE}/auth/me`).then(handleResponse<User>),
  changePassword: (payload: ChangePasswordPayload) =>
    fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(handleResponse<{ status: string; message: string }>),

  // Users Management (Admin)
  getUsers: () =>
    fetch(`${API_BASE}/users`).then(handleResponse<User[]>),
  getUser: (id: string) =>
    fetch(`${API_BASE}/users/${encodeURIComponent(id)}`).then(handleResponse<User>),
  createUser: (payload: CreateUserPayload) =>
    fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(handleResponse<User>),
  updateUser: (id: string, payload: UpdateUserPayload) =>
    fetch(`${API_BASE}/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(handleResponse<User>),
  deleteUser: (id: string) =>
    fetch(`${API_BASE}/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).then(handleResponse<{ status: string; message: string; id: string }>),

  // Reverse Proxy & Caddy SSL
  getProxyRoutes: () =>
    fetch(`${API_BASE}/proxy/routes`).then(handleResponse<import('../types').ProxyRoute[]>),
  getProxyRoute: (id: string) =>
    fetch(`${API_BASE}/proxy/routes/${encodeURIComponent(id)}`).then(handleResponse<import('../types').ProxyRoute>),
  createProxyRoute: (payload: import('../types').CreateProxyRoutePayload) =>
    fetch(`${API_BASE}/proxy/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(handleResponse<import('../types').ProxyRoute>),
  updateProxyRoute: (id: string, payload: import('../types').UpdateProxyRoutePayload) =>
    fetch(`${API_BASE}/proxy/routes/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(handleResponse<import('../types').ProxyRoute>),
  deleteProxyRoute: (id: string) =>
    fetch(`${API_BASE}/proxy/routes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).then(handleResponse<{ message: string }>),
  toggleProxyRoute: (id: string, enabled?: boolean) =>
    fetch(`${API_BASE}/proxy/routes/${encodeURIComponent(id)}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enabled !== undefined ? { enabled } : {}),
    }).then(handleResponse<import('../types').ProxyRoute>),
  getProxyStatus: () =>
    fetch(`${API_BASE}/proxy/status`).then(handleResponse<import('../types').CaddyStatus>),
  syncProxy: () =>
    fetch(`${API_BASE}/proxy/sync`, {
      method: 'POST',
    }).then(handleResponse<{ message: string }>),
  getCaddyfile: () =>
    fetch(`${API_BASE}/proxy/caddyfile`).then(handleResponse<{ caddyfile: string }>),
};

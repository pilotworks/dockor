import { Template, Stack, Container, Node, ContainerDetail, ContainerPortBinding, ContainerNetworkInfo, ContainerMount } from '../types';

const API_BASE = '/api/v1';

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
  getTemplates: () => fetch(`${API_BASE}/templates`).then(handleResponse<Template[]>),
  getTemplate: (id: string) => fetch(`${API_BASE}/templates/${id}`).then(handleResponse<Template>),
  previewTemplate: (id: string, variables: Record<string, any>) =>
    fetch(`${API_BASE}/templates/${id}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variables }),
    }).then(handleResponse<{ evaluated_variables: Record<string, any>; warnings: string[]; rendered_compose: string }>),

  // Stacks
  getStacks: () => fetch(`${API_BASE}/stacks`).then(handleResponse<Stack[]>),
  getStack: (id: string) => fetch(`${API_BASE}/stacks/${id}`).then(handleResponse<Stack>),
  deployStack: (data: { name: string; template_id?: string; compose_yaml?: string; variables?: Record<string, any> }) =>
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

  // Containers
  getContainers: () => fetch(`${API_BASE}/containers?all=true`).then(handleResponse<Container[]>),
  getContainer: (id: string) => fetch(`${API_BASE}/containers/${id}`).then(handleResponse<any>).then(normalizeContainerDetail),
  createContainer: (data: import('../types').CreateContainerPayload) =>
    fetch(`${API_BASE}/containers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse<import('../types').CreateContainerResult>),
  startContainer: (id: string) => fetch(`${API_BASE}/containers/${id}/start`, { method: 'POST' }),
  stopContainer: (id: string) => fetch(`${API_BASE}/containers/${id}/stop`, { method: 'POST' }),
  restartContainer: (id: string) => fetch(`${API_BASE}/containers/${id}/restart`, { method: 'POST' }),

  // Nodes
  getNodes: () => fetch(`${API_BASE}/nodes`).then(handleResponse<Node[]>),

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
};

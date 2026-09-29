import { Template, Stack, Container, Node } from '../types';

const API_BASE = '/api/v1';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorBody.error || `HTTP error ${res.status}`);
  }
  return res.json();
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
  getContainers: () => fetch(`${API_BASE}/containers`).then(handleResponse<Container[]>),
  startContainer: (id: string) => fetch(`${API_BASE}/containers/${id}/start`, { method: 'POST' }),
  stopContainer: (id: string) => fetch(`${API_BASE}/containers/${id}/stop`, { method: 'POST' }),
  restartContainer: (id: string) => fetch(`${API_BASE}/containers/${id}/restart`, { method: 'POST' }),

  // Nodes
  getNodes: () => fetch(`${API_BASE}/nodes`).then(handleResponse<Node[]>),
};

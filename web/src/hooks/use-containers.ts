import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAppStore } from '../stores/use-app-store';

export function useContainers() {
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);

  return useQuery({
    queryKey: ['containers', selectedNodeId],
    queryFn: () => api.getContainers(selectedNodeId),
    refetchInterval: 5000, // Poll every 5s for live container states
  });
}

export function useContainer(id?: string) {
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);

  return useQuery({
    queryKey: ['container', id, selectedNodeId],
    queryFn: () => (id ? api.getContainer(id, selectedNodeId) : null),
    enabled: Boolean(id),
    refetchInterval: 5000,
  });
}

export function useContainerAction() {
  const queryClient = useQueryClient();
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);

  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'start' | 'stop' | 'restart' }) => {
      if (action === 'start') return api.startContainer(id, selectedNodeId);
      if (action === 'stop') return api.stopContainer(id, selectedNodeId);
      return api.restartContainer(id, selectedNodeId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
  });
}

export function useCreateContainer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: import('../types').CreateContainerPayload) => api.createContainer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
      queryClient.invalidateQueries({ queryKey: ['system', 'df'] });
    },
  });
}

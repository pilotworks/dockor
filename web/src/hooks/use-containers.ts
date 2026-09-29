import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useContainers() {
  return useQuery({
    queryKey: ['containers'],
    queryFn: () => api.getContainers(),
    refetchInterval: 5000, // Poll every 5s for live container states
  });
}

export function useContainer(id?: string) {
  return useQuery({
    queryKey: ['container', id],
    queryFn: () => (id ? api.getContainer(id) : null),
    enabled: Boolean(id),
    refetchInterval: 5000,
  });
}

export function useContainerAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'start' | 'stop' | 'restart' }) => {
      if (action === 'start') return api.startContainer(id);
      if (action === 'stop') return api.stopContainer(id);
      return api.restartContainer(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
  });
}

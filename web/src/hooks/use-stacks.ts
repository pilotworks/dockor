import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAppStore } from '../stores/use-app-store';

export function useStacks() {
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);

  return useQuery({
    queryKey: ['stacks', selectedNodeId],
    queryFn: () => api.getStacks(selectedNodeId),
  });
}

export function useDeployStack() {
  const queryClient = useQueryClient();
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);

  return useMutation({
    mutationFn: (data: { name: string; template_id?: string; compose_yaml?: string; variables?: Record<string, any>; node_id?: string }) =>
      api.deployStack({ ...data, node_id: data.node_id || selectedNodeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stacks'] });
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
  });
}

export function useUpdateStack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, compose_yaml, redeploy = true }: { id: string; compose_yaml: string; redeploy?: boolean }) =>
      api.updateStack(id, { compose_yaml, redeploy }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stacks'] });
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
  });
}

export function useStartStack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.startStack(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stacks'] });
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
  });
}

export function useStopStack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.stopStack(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stacks'] });
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
  });
}

export function useRestartStack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.restartStack(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stacks'] });
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
  });
}

export function usePullStack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.pullStack(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stacks'] });
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
  });
}

export function useDeleteStack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, deleteVolumes }: { id: string; deleteVolumes?: boolean }) =>
      api.deleteStack(id, deleteVolumes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stacks'] });
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
  });
}

export function useStack(id?: string) {
  return useQuery({
    queryKey: ['stack', id],
    queryFn: () => (id ? api.getStack(id) : null),
    enabled: Boolean(id),
    refetchInterval: 5000,
  });
}

export function useStackLogs(id?: string, enabled = true) {
  return useQuery({
    queryKey: ['stack-logs', id],
    queryFn: () => (id ? api.getStackLogs(id) : null),
    enabled: Boolean(id) && enabled,
    refetchInterval: 6000,
  });
}


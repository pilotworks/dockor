import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useStacks() {
  return useQuery({
    queryKey: ['stacks'],
    queryFn: () => api.getStacks(),
  });
}

export function useDeployStack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; template_id?: string; compose_yaml?: string; variables?: Record<string, any> }) =>
      api.deployStack(data),
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

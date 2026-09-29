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

export function useDeleteStack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteStack(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stacks'] });
    },
  });
}

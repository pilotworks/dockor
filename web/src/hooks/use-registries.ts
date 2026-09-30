import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { CreateRegistryPayload, UpdateRegistryPayload } from '../types';

export function useRegistries() {
  return useQuery({
    queryKey: ['registries'],
    queryFn: () => api.getRegistries(),
  });
}

export function useRegistry(id?: string) {
  return useQuery({
    queryKey: ['registries', id],
    queryFn: () => (id ? api.getRegistry(id) : null),
    enabled: Boolean(id),
  });
}

export function useCreateRegistry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRegistryPayload) => api.createRegistry(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registries'] });
    },
  });
}

export function useUpdateRegistry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateRegistryPayload }) =>
      api.updateRegistry(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registries'] });
    },
  });
}

export function useDeleteRegistry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteRegistry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registries'] });
    },
  });
}

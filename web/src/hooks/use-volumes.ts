import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { CreateVolumePayload } from '../types';

export function useVolumes() {
  return useQuery({
    queryKey: ['volumes'],
    queryFn: () => api.getVolumes(),
    refetchInterval: 10000,
  });
}

export function useVolume(name?: string) {
  return useQuery({
    queryKey: ['volume', name],
    queryFn: () => (name ? api.getVolume(name) : null),
    enabled: Boolean(name),
    refetchInterval: 6000,
  });
}

export function useCreateVolume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateVolumePayload) => api.createVolume(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volumes'] });
      queryClient.invalidateQueries({ queryKey: ['system-disk-usage'] });
    },
  });
}

export function useDeleteVolume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, force }: { name: string; force?: boolean }) => api.deleteVolume(name, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volumes'] });
      queryClient.invalidateQueries({ queryKey: ['system-disk-usage'] });
    },
  });
}

export function usePruneVolumes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.pruneVolumes(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volumes'] });
      queryClient.invalidateQueries({ queryKey: ['system-disk-usage'] });
    },
  });
}

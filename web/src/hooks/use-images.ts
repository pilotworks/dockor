import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useImages() {
  return useQuery({
    queryKey: ['images'],
    queryFn: () => api.getImages(),
    refetchInterval: 10000,
  });
}

export function useImage(id?: string) {
  return useQuery({
    queryKey: ['image', id],
    queryFn: () => (id ? api.getImage(id) : null),
    enabled: Boolean(id),
  });
}

export function useDeleteImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => api.deleteImage(id, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] });
      queryClient.invalidateQueries({ queryKey: ['system-disk-usage'] });
    },
  });
}

export function usePruneImages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (all?: boolean) => api.pruneImages(all),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] });
      queryClient.invalidateQueries({ queryKey: ['system-disk-usage'] });
    },
  });
}

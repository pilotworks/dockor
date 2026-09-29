import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { PruneOptions } from '../types';

export function useSystemDiskUsage(enabled = true) {
  return useQuery({
    queryKey: ['system', 'df'],
    queryFn: () => api.getSystemDiskUsage(),
    enabled,
    staleTime: 5000,
  });
}

export function useSystemPrune() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (options?: PruneOptions) => api.pruneSystem(options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system', 'df'] });
      queryClient.invalidateQueries({ queryKey: ['containers'] });
      queryClient.invalidateQueries({ queryKey: ['stacks'] });
    },
  });
}

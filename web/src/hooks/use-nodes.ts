import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useNodes() {
  return useQuery({
    queryKey: ['nodes'],
    queryFn: () => api.getNodes(),
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api.getHealth(),
    refetchInterval: 10000,
  });
}

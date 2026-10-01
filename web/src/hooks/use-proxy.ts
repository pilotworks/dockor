import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { CreateProxyRoutePayload, UpdateProxyRoutePayload } from '../types';

export function useProxyRoutes() {
  return useQuery({
    queryKey: ['proxy-routes'],
    queryFn: () => api.getProxyRoutes(),
    refetchInterval: 15000,
  });
}

export function useProxyRoute(id?: string) {
  return useQuery({
    queryKey: ['proxy-routes', id],
    queryFn: () => (id ? api.getProxyRoute(id) : null),
    enabled: Boolean(id),
  });
}

export function useProxyStatus() {
  return useQuery({
    queryKey: ['proxy-status'],
    queryFn: () => api.getProxyStatus(),
    refetchInterval: 10000,
  });
}

export function useCaddyfile() {
  return useQuery({
    queryKey: ['caddyfile-preview'],
    queryFn: () => api.getCaddyfile(),
  });
}

export function useCreateProxyRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProxyRoutePayload) => api.createProxyRoute(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxy-routes'] });
      queryClient.invalidateQueries({ queryKey: ['proxy-status'] });
      queryClient.invalidateQueries({ queryKey: ['caddyfile-preview'] });
    },
  });
}

export function useUpdateProxyRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateProxyRoutePayload }) =>
      api.updateProxyRoute(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxy-routes'] });
      queryClient.invalidateQueries({ queryKey: ['proxy-status'] });
      queryClient.invalidateQueries({ queryKey: ['caddyfile-preview'] });
    },
  });
}

export function useDeleteProxyRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteProxyRoute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxy-routes'] });
      queryClient.invalidateQueries({ queryKey: ['proxy-status'] });
      queryClient.invalidateQueries({ queryKey: ['caddyfile-preview'] });
    },
  });
}

export function useToggleProxyRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled?: boolean }) =>
      api.toggleProxyRoute(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxy-routes'] });
      queryClient.invalidateQueries({ queryKey: ['proxy-status'] });
      queryClient.invalidateQueries({ queryKey: ['caddyfile-preview'] });
    },
  });
}

export function useSyncProxy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.syncProxy(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxy-routes'] });
      queryClient.invalidateQueries({ queryKey: ['proxy-status'] });
      queryClient.invalidateQueries({ queryKey: ['caddyfile-preview'] });
    },
  });
}

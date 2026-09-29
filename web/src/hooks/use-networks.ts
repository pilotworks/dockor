import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { CreateNetworkPayload } from '../types';

export function useNetworks() {
  return useQuery({
    queryKey: ['networks'],
    queryFn: () => api.getNetworks(),
    refetchInterval: 10000,
  });
}

export function useNetwork(id?: string) {
  return useQuery({
    queryKey: ['network', id],
    queryFn: () => (id ? api.getNetwork(id) : null),
    enabled: Boolean(id),
    refetchInterval: 6000,
  });
}

export function useCreateNetwork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateNetworkPayload) => api.createNetwork(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['networks'] });
    },
  });
}

export function useDeleteNetwork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteNetwork(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['networks'] });
    },
  });
}

export function useConnectNetwork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ networkId, containerId }: { networkId: string; containerId: string }) =>
      api.connectNetwork(networkId, containerId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['network', variables.networkId] });
      queryClient.invalidateQueries({ queryKey: ['networks'] });
      queryClient.invalidateQueries({ queryKey: ['containers'] });
      queryClient.invalidateQueries({ queryKey: ['container', variables.containerId] });
    },
  });
}

export function useDisconnectNetwork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      networkId,
      containerId,
      force,
    }: {
      networkId: string;
      containerId: string;
      force?: boolean;
    }) => api.disconnectNetwork(networkId, containerId, force),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['network', variables.networkId] });
      queryClient.invalidateQueries({ queryKey: ['networks'] });
      queryClient.invalidateQueries({ queryKey: ['containers'] });
      queryClient.invalidateQueries({ queryKey: ['container', variables.containerId] });
    },
  });
}

import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: () => api.getTemplates(),
  });
}

export function useTemplate(id: string | null) {
  return useQuery({
    queryKey: ['template', id],
    queryFn: () => (id ? api.getTemplate(id) : null),
    enabled: Boolean(id),
  });
}

export function usePreviewTemplate() {
  return useMutation({
    mutationFn: ({ id, variables }: { id: string; variables: Record<string, any> }) =>
      api.previewTemplate(id, variables),
  });
}

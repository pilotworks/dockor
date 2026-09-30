import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useEventStore } from '../stores/use-event-store';
import { api } from '../lib/api';
import { DockerDaemonEvent } from '../types';
import { toast } from 'sonner';

export function useDockerEvents() {
  const queryClient = useQueryClient();
  const { addEvent, setEvents } = useEventStore();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // 1. Fetch initial recent event history
    api.getEventHistory().then((history) => {
      if (Array.isArray(history)) {
        setEvents(history);
      }
    }).catch(() => {
      // ignore
    });

    // 2. Open SSE stream
    const sseUrl = api.getEventStreamUrl();
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onmessage = (messageEvent) => {
      try {
        const event: DockerDaemonEvent = JSON.parse(messageEvent.data);
        addEvent(event);

        const actorName = event.actor_name || event.actor_id.slice(0, 12);

        // Smart Cache Invalidation based on event type
        if (event.type === 'container') {
          queryClient.invalidateQueries({ queryKey: ['containers'] });
          queryClient.invalidateQueries({ queryKey: ['container', event.actor_id] });
          queryClient.invalidateQueries({ queryKey: ['system-disk-usage'] });

          // Notify on critical container events
          if (event.action === 'die') {
            const exitCode = event.attributes?.exitCode;
            if (exitCode && exitCode !== '0') {
              toast.error(`Container "${actorName}" exited with code ${exitCode}`, {
                description: `Exit code: ${exitCode}. Check container logs for failure details.`,
              });
            }
          } else if (event.action === 'oom') {
            toast.error(`Container "${actorName}" was killed by Out-of-Memory (OOM)`, {
              description: 'The kernel OOM-killer terminated this container.',
            });
          }
        } else if (event.type === 'image') {
          queryClient.invalidateQueries({ queryKey: ['images'] });
          queryClient.invalidateQueries({ queryKey: ['system-disk-usage'] });
        } else if (event.type === 'volume') {
          queryClient.invalidateQueries({ queryKey: ['volumes'] });
          queryClient.invalidateQueries({ queryKey: ['system-disk-usage'] });
        } else if (event.type === 'network') {
          queryClient.invalidateQueries({ queryKey: ['networks'] });
        }
      } catch {
        // ignore parse error
      }
    };

    es.onerror = () => {
      // EventSource automatically reconnects on error
    };

    return () => {
      es.close();
    };
  }, [addEvent, setEvents, queryClient]);
}

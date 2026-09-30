import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconX,
  IconActivity,
  IconBox,
  IconDisc,
  IconDatabase,
  IconNetwork,
  IconTrash,
  IconExternalLink,
  IconClock,
} from '@tabler/icons-react';
import { Button } from '../ui/button';
import { useEventStore } from '../../stores/use-event-store';
import { DockerDaemonEvent } from '../../types';

function formatEventTime(timeUnix: number): string {
  if (!timeUnix) return '';
  const d = new Date(timeUnix * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getActionBadge(action: string) {
  const act = action.toLowerCase();
  if (act === 'start' || act === 'create' || act === 'unpause') {
    return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
  }
  if (act === 'die' || act === 'oom' || act === 'kill' || act === 'destroy') {
    return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
  }
  if (act === 'stop' || act === 'pause' || act === 'restart') {
    return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
  }
  if (act === 'pull' || act === 'tag' || act === 'push' || act === 'commit') {
    return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
  }
  return 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20';
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'container':
      return <IconBox className="w-3.5 h-3.5 text-blue-500" />;
    case 'image':
      return <IconDisc className="w-3.5 h-3.5 text-purple-500" />;
    case 'volume':
      return <IconDatabase className="w-3.5 h-3.5 text-emerald-500" />;
    case 'network':
      return <IconNetwork className="w-3.5 h-3.5 text-cyan-500" />;
    default:
      return <IconActivity className="w-3.5 h-3.5 text-zinc-400" />;
  }
}

export function ActivityDrawer() {
  const { events, isDrawerOpen, closeDrawer, clearEvents } = useEventStore();
  const [filterType, setFilterType] = useState<string>('all');
  const navigate = useNavigate();

  const filteredEvents = useMemo(() => {
    if (filterType === 'all') return events;
    return events.filter((e) => e.type === filterType);
  }, [events, filterType]);

  if (!isDrawerOpen) return null;

  const handleActorClick = (event: DockerDaemonEvent) => {
    if (event.type === 'container' && event.actor_id) {
      navigate(`/containers/${event.actor_id}`);
      closeDrawer();
    } else if (event.type === 'image' && event.actor_id) {
      navigate(`/images/${event.actor_id}`);
      closeDrawer();
    } else if (event.type === 'volume' && event.actor_name) {
      navigate(`/volumes/${event.actor_name}`);
      closeDrawer();
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) closeDrawer();
      }}
      className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 backdrop-blur-xs flex justify-end animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-[#121216] border-l border-zinc-200 dark:border-[#23232A] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-[#202026] bg-zinc-50/80 dark:bg-[#0E0E12] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <IconActivity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  Docker Daemon Activity
                </span>
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Live
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Real-time kernel & container lifecycle telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="surface"
              size="sm"
              onClick={clearEvents}
              className="h-7 px-2 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              title="Clear event history"
            >
              <IconTrash className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="surface"
              size="sm"
              onClick={closeDrawer}
              className="h-7 px-2 text-xs"
              title="Close drawer"
            >
              <IconX className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Filter Type Pills */}
        <div className="px-4 py-2 border-b border-zinc-200 dark:border-[#202026] flex items-center gap-1.5 overflow-x-auto select-none shrink-0 bg-white dark:bg-[#121216]">
          {['all', 'container', 'image', 'volume', 'network'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterType(t)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all capitalize whitespace-nowrap cursor-pointer ${
                filterType === t
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
              }`}
            >
              {t === 'all' ? 'All Events' : `${t}s`}
            </button>
          ))}
        </div>

        {/* Events Feed List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredEvents.length === 0 ? (
            <div className="py-16 text-center text-xs text-zinc-400 space-y-2">
              <IconActivity className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto" />
              <p>No Docker daemon events recorded yet.</p>
              <p className="text-[11px] text-zinc-500">
                Trigger a container start, stop, or image pull to see live events stream here.
              </p>
            </div>
          ) : (
            filteredEvents.map((ev, idx) => {
              const actorDisplay = ev.actor_name || ev.actor_id.slice(0, 12);
              const actionBadge = getActionBadge(ev.action);
              const canNavigate = ev.type === 'container' || ev.type === 'image' || ev.type === 'volume';

              return (
                <div
                  key={`${ev.actor_id}-${ev.timestamp}-${idx}`}
                  className="p-3 rounded-xl border border-zinc-200 dark:border-[#202026] bg-zinc-50/50 dark:bg-[#0E0E12]/60 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30 transition-all space-y-1.5"
                >
                  {/* Top row: Type, Action Badge, Time */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {getTypeIcon(ev.type)}
                      <span className="text-[11px] uppercase font-mono font-semibold text-zinc-500 dark:text-zinc-400">
                        {ev.type}
                      </span>
                      <span
                        className={`text-[10px] font-mono uppercase font-bold tracking-wider px-1.5 py-0.2 rounded border ${actionBadge}`}
                      >
                        {ev.action}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                      <IconClock className="w-2.5 h-2.5" />
                      {formatEventTime(ev.timestamp)}
                    </span>
                  </div>

                  {/* Actor details */}
                  <div className="flex items-center justify-between gap-2">
                    <div
                      onClick={() => canNavigate && handleActorClick(ev)}
                      className={`text-xs font-mono font-medium truncate ${
                        canNavigate
                          ? 'cursor-pointer text-zinc-800 dark:text-zinc-200 hover:text-blue-600 dark:hover:text-blue-400 hover:underline flex items-center gap-1'
                          : 'text-zinc-700 dark:text-zinc-300'
                      }`}
                      title={actorDisplay}
                    >
                      <span>{actorDisplay}</span>
                      {canNavigate && <IconExternalLink className="w-3 h-3 text-zinc-400" />}
                    </div>

                    {ev.attributes?.image && (
                      <span className="text-[10px] text-zinc-400 truncate max-w-[140px] font-mono">
                        {ev.attributes.image}
                      </span>
                    )}
                  </div>

                  {/* Extra attributes if present */}
                  {ev.attributes?.exitCode && (
                    <div className="text-[10px] font-mono text-red-500">
                      Exit Code: {ev.attributes.exitCode}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-zinc-200 dark:border-[#202026] bg-zinc-50/50 dark:bg-[#0E0E12] flex items-center justify-between text-[11px] font-mono text-zinc-400 shrink-0">
          <span>{filteredEvents.length} events logged</span>
          <span>Buffer: Last 100</span>
        </div>
      </div>
    </div>
  );
}

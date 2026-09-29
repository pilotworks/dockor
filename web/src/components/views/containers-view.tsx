import { useState } from 'react';
import { useContainers, useContainerAction } from '../../hooks/use-containers';
import {
  IconBox,
  IconRotateClockwise,
  IconPower,
  IconDotsVertical,
  IconExternalLink,
  IconTerminal2,
  IconFileText,
  IconActivity,
  IconTrash,
  IconCircleFilled,
} from '@tabler/icons-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { ContainerTerminalModal } from '../containers/container-terminal-modal';
import { ContainerLogsModal } from '../containers/container-logs-modal';
import { ContainerStatsModal } from '../containers/container-stats-modal';
import { SystemPruneModal } from '../system/system-prune-modal';

export function ContainersView() {
  const { data: containers = [], isLoading } = useContainers();
  const actionMutation = useContainerAction();
  const [filterState, setFilterState] = useState<'all' | 'running' | 'stopped'>('all');
  const [search, setSearch] = useState('');
  const [isPruneOpen, setIsPruneOpen] = useState(false);
  const [terminalContainer, setTerminalContainer] = useState<{ id: string; name: string } | null>(null);
  const [logsContainer, setLogsContainer] = useState<{ id: string; name: string } | null>(null);
  const [statsContainer, setStatsContainer] = useState<{ id: string; name: string } | null>(null);

  const handleAction = async (id: string, action: 'start' | 'stop' | 'restart', name: string) => {
    try {
      await actionMutation.mutateAsync({ id, action });
      toast.success(`Container ${name} ${action}ed`);
    } catch (err: any) {
      toast.error(`Failed to ${action} container`, { description: err.message });
    }
  };

  const filtered = containers.filter((c) => {
    const isRunning = c.state === 'running';
    if (filterState === 'running' && !isRunning) return false;
    if (filterState === 'stopped' && isRunning) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchName = c.names?.some((n) => n.toLowerCase().includes(q));
      const matchImage = c.image.toLowerCase().includes(q);
      const matchId = c.id.toLowerCase().includes(q);
      return matchName || matchImage || matchId;
    }
    return true;
  });

  const totalRunning = containers.filter((c) => c.state === 'running').length;

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-[#23232A] rounded-xl p-3 transition-colors">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilterState('all')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              filterState === 'all'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            )}
          >
            All Containers ({containers.length})
          </button>
          <button
            onClick={() => setFilterState('running')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
              filterState === 'running'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            Running ({totalRunning})
          </button>
          <button
            onClick={() => setFilterState('stopped')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
              filterState === 'stopped'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
            Stopped ({containers.length - totalRunning})
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Filter containers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 px-3 bg-white dark:bg-[#0A0A0C] border border-zinc-200 dark:border-[#272730] rounded-lg text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 shadow-sm dark:shadow-none transition-colors"
            />
          </div>

          <Button
            variant="surface"
            size="sm"
            onClick={() => setIsPruneOpen(true)}
            className="h-8 px-2.5 text-xs gap-1.5 shrink-0 text-zinc-700 dark:text-zinc-300 hover:text-amber-600 dark:hover:text-amber-400"
            title="Clean stopped containers and unused Docker resources"
          >
            <IconTrash className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Prune</span>
          </Button>
        </div>
      </div>

      {/* High-Density DevOps Table */}
      <div className="border border-zinc-200 dark:border-[#23232A] rounded-xl bg-white dark:bg-[#111115] overflow-hidden shadow-sm transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-[#1F1F24] bg-zinc-50 dark:bg-[#0C0C0F] text-[10px] uppercase font-semibold text-zinc-500 dark:text-zinc-400 tracking-wider">
                <th className="py-3 px-4 w-32">Status</th>
                <th className="py-3 px-4">Container</th>
                <th className="py-3 px-4">Image</th>
                <th className="py-3 px-4">Ports</th>
                <th className="py-3 px-4">Stack</th>
                <th className="py-3 px-4 text-right w-28">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-100 dark:divide-[#1C1C22]">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500 text-xs">
                    Loading containers from Docker Engine...
                  </td>
                </tr>
              )}

              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <IconBox className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-2" />
                    <p className="text-zinc-800 dark:text-zinc-400 font-medium">No containers found</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-600 mt-0.5">
                      Launch a stack from the template catalog to deploy containers.
                    </p>
                  </td>
                </tr>
              )}

              {!isLoading &&
                filtered.map((c) => {
                  const containerName = c.names?.[0]?.replace(/^\//, '') || c.id.substring(0, 12);
                  const isRunning = c.state === 'running';
                  const shortId = c.id.substring(0, 10);

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-zinc-100/80 dark:hover:bg-zinc-800/50 transition-colors group select-text"
                    >
                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <IconCircleFilled
                            className={cn(
                              'w-2 h-2 shrink-0',
                              isRunning ? 'text-emerald-500 dark:text-emerald-400 animate-pulse' : 'text-zinc-400 dark:text-zinc-600'
                            )}
                          />
                          <span
                            className={cn(
                              'font-medium text-[11px]',
                              isRunning ? 'text-zinc-900 dark:text-zinc-200' : 'text-zinc-500 dark:text-zinc-500'
                            )}
                          >
                            {isRunning ? 'Running' : 'Exited'}
                          </span>
                        </div>
                      </td>

                      {/* Name & Short ID */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {containerName}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">{shortId}</span>
                        </div>
                      </td>

                      {/* Image */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                          {c.image}
                        </span>
                      </td>

                      {/* Ports */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {c.ports && c.ports.filter((p) => p.public_port).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {c.ports
                              .filter((p) => p.public_port)
                              .map((p, idx) => (
                                <a
                                  key={idx}
                                  href={`http://localhost:${p.public_port}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 font-mono text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800/40 transition-colors"
                                >
                                  <span>
                                    {p.public_port}:{p.private_port}
                                  </span>
                                  <IconExternalLink className="w-2.5 h-2.5" />
                                </a>
                              ))}
                          </div>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-600 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Stack Name */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {c.stack_name ? (
                          <Badge variant="neutral" className="text-[10px] font-mono">
                            {c.stack_name}
                          </Badge>
                        ) : (
                          <span className="text-zinc-600 text-[11px]">standalone</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="surface"
                            size="icon-sm"
                            disabled={!isRunning}
                            onClick={() => setTerminalContainer({ id: c.id, name: containerName })}
                            title={isRunning ? 'Exec Terminal (xterm.js)' : 'Container must be running to exec shell'}
                            className={cn(isRunning ? 'text-blue-500 dark:text-blue-400 hover:text-blue-600' : 'opacity-30 cursor-not-allowed')}
                          >
                            <IconTerminal2 className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            variant="surface"
                            size="icon-sm"
                            onClick={() => setLogsContainer({ id: c.id, name: containerName })}
                            title="View Live Logs"
                          >
                            <IconFileText className="w-3.5 h-3.5 text-zinc-400 hover:text-zinc-200" />
                          </Button>

                          <Button
                            variant="surface"
                            size="icon-sm"
                            disabled={!isRunning}
                            onClick={() => setStatsContainer({ id: c.id, name: containerName })}
                            title={isRunning ? 'Live Telemetry & Resource Stats' : 'Container must be running to view stats'}
                            className={cn(isRunning ? 'text-purple-400 hover:text-purple-300' : 'opacity-30 cursor-not-allowed')}
                          >
                            <IconActivity className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            variant="surface"
                            size="icon-sm"
                            onClick={() => handleAction(c.id, 'restart', containerName)}
                            title="Restart Container"
                          >
                            <IconRotateClockwise className="w-3.5 h-3.5 text-zinc-400" />
                          </Button>

                          <Button
                            variant={isRunning ? 'surface' : 'primary'}
                            size="icon-sm"
                            onClick={() =>
                              handleAction(c.id, isRunning ? 'stop' : 'start', containerName)
                            }
                            title={isRunning ? 'Stop Container' : 'Start Container'}
                          >
                            <IconPower
                              className={cn(
                                'w-3.5 h-3.5',
                                isRunning ? 'text-red-400' : 'text-white'
                              )}
                            />
                          </Button>

                          {/* 3-Dots Dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm">
                                <IconDotsVertical className="w-3.5 h-3.5 text-zinc-400" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                disabled={!isRunning}
                                onClick={() => setTerminalContainer({ id: c.id, name: containerName })}
                              >
                                <IconTerminal2 className="w-3.5 h-3.5 text-blue-400" />
                                <span>Exec Shell Terminal</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setLogsContainer({ id: c.id, name: containerName })}
                              >
                                <IconFileText className="w-3.5 h-3.5 text-zinc-400" />
                                <span>View Container Logs</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!isRunning}
                                onClick={() => setStatsContainer({ id: c.id, name: containerName })}
                              >
                                <IconActivity className="w-3.5 h-3.5 text-purple-400" />
                                <span>Live Telemetry & Stats</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleAction(c.id, 'stop', containerName)}
                                className="text-red-400 focus:text-red-300"
                              >
                                <IconTrash className="w-3.5 h-3.5" />
                                <span>Force Stop & Remove</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Terminal Modal */}
      {terminalContainer && (
        <ContainerTerminalModal
          containerId={terminalContainer.id}
          containerName={terminalContainer.name}
          isOpen={Boolean(terminalContainer)}
          onClose={() => setTerminalContainer(null)}
        />
      )}

      {/* Logs Modal */}
      {logsContainer && (
        <ContainerLogsModal
          containerId={logsContainer.id}
          containerName={logsContainer.name}
          isOpen={Boolean(logsContainer)}
          onClose={() => setLogsContainer(null)}
        />
      )}

      {/* Stats Modal */}
      {statsContainer && (
        <ContainerStatsModal
          containerId={statsContainer.id}
          containerName={statsContainer.name}
          isOpen={Boolean(statsContainer)}
          onClose={() => setStatsContainer(null)}
        />
      )}

      {/* System Prune Modal */}
      <SystemPruneModal
        isOpen={isPruneOpen}
        onClose={() => setIsPruneOpen(false)}
      />
    </div>
  );
}

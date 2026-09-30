import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  IconMaximize,
  IconLoader2,
  IconPlus,
} from '@tabler/icons-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/use-app-store';
import { useNodes } from '../../hooks/use-nodes';
import { confirmDialog } from '../../stores/use-dialog-store';
import { ContainerTerminalModal } from '../containers/container-terminal-modal';
import { ContainerLogsModal } from '../containers/container-logs-modal';
import { ContainerStatsModal } from '../containers/container-stats-modal';
import { SystemPruneModal } from '../system/system-prune-modal';
import { CreateContainerModal } from '../containers/create-container-modal';

export function ContainersView() {
  const navigate = useNavigate();
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const { data: nodes = [] } = useNodes();
  const activeNode = nodes.find((n) => n.id === selectedNodeId) || nodes.find((n) => n.is_local);
  const { data: containers = [], isLoading, refetch } = useContainers();
  const actionMutation = useContainerAction();
  const [filterState, setFilterState] = useState<'all' | 'running' | 'stopped'>('all');
  const [search, setSearch] = useState('');
  const [isPruneOpen, setIsPruneOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [terminalContainer, setTerminalContainer] = useState<{ id: string; name: string } | null>(null);
  const [logsContainer, setLogsContainer] = useState<{ id: string; name: string } | null>(null);
  const [statsContainer, setStatsContainer] = useState<{ id: string; name: string } | null>(null);
  const [loadingAction, setLoadingAction] = useState<{ id: string; action: 'start' | 'stop' | 'restart' } | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const handleAction = async (id: string, action: 'start' | 'stop' | 'restart', name: string) => {
    setLoadingAction({ id, action });
    try {
      await actionMutation.mutateAsync({ id, action });
      toast.success(`Container ${name} ${action}ed`);
    } catch (err: any) {
      toast.error(`Failed to ${action} container`, { description: err.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)));
    }
  };

  const handleBatchAction = async (action: 'start' | 'stop' | 'restart' | 'delete') => {
    if (selectedIds.size === 0) return;

    if (action === 'delete') {
      const confirmed = await confirmDialog({
        title: `Delete ${selectedIds.size} Container(s)`,
        description: `Are you sure you want to permanently delete ${selectedIds.size} selected container(s)? This will force remove them from your host.`,
        confirmText: 'Delete Containers',
        variant: 'destructive',
      });
      if (!confirmed) return;
    }

    setIsBatchProcessing(true);
    const toastId = toast.loading(`Performing ${action} on ${selectedIds.size} container(s)...`);
    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      try {
        if (action === 'start') await api.startContainer(id, selectedNodeId);
        else if (action === 'stop') await api.stopContainer(id, selectedNodeId);
        else if (action === 'restart') await api.restartContainer(id, selectedNodeId);
        else if (action === 'delete') await api.deleteContainer(id, true, selectedNodeId);
        successCount++;
      } catch {
        failCount++;
      }
    }

    setIsBatchProcessing(false);
    setSelectedIds(new Set());
    refetch();
    toast.dismiss(toastId);

    if (failCount === 0) {
      toast.success(`Successfully ${action}ed ${successCount} container(s)`);
    } else {
      toast.warning(`Finished ${action}: ${successCount} succeeded, ${failCount} failed`);
    }
  };

  const filtered = containers.filter((c) => {
    const isRunning = c.state?.toLowerCase() === 'running';
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

  const totalRunning = containers.filter((c) => c.state?.toLowerCase() === 'running').length;

  return (
    <div className="space-y-4">
      {/* Remote Node Indicator Banner */}
      {selectedNodeId !== 'node_local' && activeNode && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span>
              Inspecting containers on remote host: <strong>{activeNode.name}</strong> ({activeNode.hostname || activeNode.ip_address})
            </span>
          </div>
          <Badge variant="outline" className="text-[10px] border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400">
            Remote Agent Mode
          </Badge>
        </div>
      )}

      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-[#23232A] rounded-xl p-3 transition-colors">
        <div className="flex items-center gap-1.5">
          <Button
            variant={filterState === 'all' ? 'surface' : 'ghost'}
            size="sm"
            onClick={() => setFilterState('all')}
            className={filterState === 'all' ? 'shadow-sm' : 'text-zinc-500'}
          >
            All Containers ({containers.length})
          </Button>
          <Button
            variant={filterState === 'running' ? 'surface' : 'ghost'}
            size="sm"
            onClick={() => setFilterState('running')}
            className={filterState === 'running' ? 'shadow-sm' : 'text-zinc-500'}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 mr-1.5" />
            Running ({totalRunning})
          </Button>
          <Button
            variant={filterState === 'stopped' ? 'surface' : 'ghost'}
            size="sm"
            onClick={() => setFilterState('stopped')}
            className={filterState === 'stopped' ? 'shadow-sm' : 'text-zinc-500'}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 mr-1.5" />
            Stopped ({containers.length - totalRunning})
          </Button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="w-full sm:w-64">
            <Input
              type="text"
              placeholder="Filter containers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8"
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

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="h-8 px-2.5 text-xs gap-1.5 shrink-0"
          >
            <IconPlus className="w-3.5 h-3.5" />
            <span>Run Container</span>
          </Button>
        </div>
      </div>

      {/* High-Density DevOps Table */}
      <div className="border border-zinc-200 dark:border-[#23232A] rounded-xl bg-white dark:bg-[#111115] overflow-hidden shadow-sm transition-colors">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-zinc-200 dark:border-[#1F1F24] bg-zinc-50 dark:bg-[#0C0C0F] text-[10px] uppercase font-semibold text-zinc-500 dark:text-zinc-400 tracking-wider">
              <TableHead className="py-3 px-3 w-9 text-center">
                <div className="flex items-center justify-center">
                  <Checkbox
                    size="sm"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < filtered.length}
                    onChange={toggleSelectAll}
                  />
                </div>
              </TableHead>
              <TableHead className="py-3 px-4 w-32">Status</TableHead>
              <TableHead className="py-3 px-4">Container</TableHead>
              <TableHead className="py-3 px-4">Image</TableHead>
              <TableHead className="py-3 px-4">Ports</TableHead>
              <TableHead className="py-3 px-4">Stack</TableHead>
              <TableHead className="py-3 px-4 text-right w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-zinc-100 dark:divide-[#1C1C22]">
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-zinc-500 text-xs">
                  Loading containers from Docker Engine...
                </TableCell>
              </TableRow>
            )}

            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center">
                  <IconBox className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-2" />
                  <p className="text-zinc-800 dark:text-zinc-400 font-medium">No containers found</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-600 mt-0.5">
                    Launch a stack from the template catalog to deploy containers.
                  </p>
                </TableCell>
              </TableRow>
            )}

              {!isLoading &&
                filtered.map((c) => {
                  const containerName = c.names?.[0]?.replace(/^\//, '') || c.id.substring(0, 12);
                  const isRunning = c.state === 'running';
                  const shortId = c.id.substring(0, 10);
                  const isSelected = selectedIds.has(c.id);

                  return (
                    <TableRow
                      key={c.id}
                      className={cn(
                        'hover:bg-zinc-100/80 dark:hover:bg-zinc-800/50 transition-colors group select-text',
                        isSelected && 'bg-blue-50/50 dark:bg-blue-950/20'
                      )}
                    >
                      {/* Checkbox */}
                      <TableCell className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center">
                          <Checkbox
                            size="sm"
                            checked={isSelected}
                            onChange={(e) => toggleSelect(c.id, e as any)}
                          />
                        </div>
                      </TableCell>
                      {/* Status */}
                      <TableCell className="py-3.5 px-4 whitespace-nowrap">
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
                            {isRunning ? 'Running' : 'Stopped'}
                          </span>
                        </div>
                      </TableCell>

                      {/* Name & Short ID */}
                      <TableCell className="py-3.5 px-4 whitespace-nowrap">
                        <div
                          className="flex flex-col cursor-pointer group/name inline-flex"
                          onClick={() => navigate(`/containers/${c.id}`)}
                          title="Open Container Details"
                        >
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover/name:text-blue-600 dark:group-hover/name:text-blue-400 transition-colors">
                            {containerName}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">{shortId}</span>
                        </div>
                      </TableCell>

                      {/* Image */}
                      <TableCell className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                          {c.image}
                        </span>
                      </TableCell>

                      {/* Ports */}
                      <TableCell className="py-3.5 px-4 whitespace-nowrap">
                        {c.ports && c.ports.filter((p) => p.public_port).length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[320px]">
                            {c.ports
                              .filter((p) => p.public_port)
                              .map((p, idx) => {
                                const ipDisplay = p.ip ? (p.ip === '::' ? '[::]' : p.ip) : '';
                                const host = p.ip && p.ip !== '0.0.0.0' && p.ip !== '::' ? p.ip : 'localhost';
                                return (
                                  <a
                                    key={idx}
                                    href={`http://${host}:${p.public_port}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 font-mono text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800/40 transition-colors"
                                  >
                                    <span>
                                      {ipDisplay && (
                                        <span className="text-zinc-500 dark:text-zinc-400">
                                          {ipDisplay}:
                                        </span>
                                      )}
                                      {p.public_port}:{p.private_port}
                                    </span>
                                    <IconExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                );
                              })}
                          </div>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-600 text-[11px]">—</span>
                        )}
                      </TableCell>

                      {/* Stack Name */}
                      <TableCell className="py-3.5 px-4 whitespace-nowrap">
                        {c.stack_name ? (
                          <Badge variant="neutral" className="text-[10px] font-mono">
                            {c.stack_name}
                          </Badge>
                        ) : (
                          <span className="text-zinc-600 text-[11px]">standalone</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-3.5 px-4 whitespace-nowrap text-right">
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
                            disabled={!isRunning || loadingAction?.id === c.id}
                            onClick={() => handleAction(c.id, 'restart', containerName)}
                            title="Restart Container"
                          >
                            {loadingAction?.id === c.id && loadingAction.action === 'restart' ? (
                              <IconLoader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                            ) : (
                              <IconRotateClockwise className="w-3.5 h-3.5 text-zinc-400" />
                            )}
                          </Button>

                          <Button
                            variant={isRunning ? 'surface' : 'primary'}
                            size="icon-sm"
                            disabled={loadingAction?.id === c.id}
                            onClick={() =>
                              handleAction(c.id, isRunning ? 'stop' : 'start', containerName)
                            }
                            title={isRunning ? 'Stop Container' : 'Start Container'}
                          >
                            {loadingAction?.id === c.id && (loadingAction.action === 'start' || loadingAction.action === 'stop') ? (
                              <IconLoader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                            ) : (
                              <IconPower
                                className={cn(
                                  'w-3.5 h-3.5',
                                  isRunning ? 'text-red-400' : 'text-white'
                                )}
                              />
                            )}
                          </Button>

                          {/* 3-Dots Dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" disabled={loadingAction?.id === c.id}>
                                <IconDotsVertical className="w-3.5 h-3.5 text-zinc-400" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/containers/${c.id}`)}>
                                <IconMaximize className="w-3.5 h-3.5 text-emerald-500" />
                                <span>Inspect & Details</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
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
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
      </div>

      {/* Floating Batch Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-zinc-900/95 dark:bg-[#18181D]/95 backdrop-blur-md text-white px-5 py-2.5 rounded-2xl shadow-2xl border border-zinc-700/70 dark:border-zinc-700/60 flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <Badge variant="info" className="text-xs px-2.5 py-0.5">
            {selectedIds.size} Selected
          </Badge>
          <div className="h-4 w-px bg-zinc-700" />
          <Button
            size="sm"
            variant="ghost"
            disabled={isBatchProcessing}
            onClick={() => handleBatchAction('start')}
            className="text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 gap-1.5 h-8 px-2.5"
          >
            <IconPower className="w-3.5 h-3.5" /> Start
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isBatchProcessing}
            onClick={() => handleBatchAction('stop')}
            className="text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 gap-1.5 h-8 px-2.5"
          >
            <IconPower className="w-3.5 h-3.5" /> Stop
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isBatchProcessing}
            onClick={() => handleBatchAction('restart')}
            className="text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-950/40 gap-1.5 h-8 px-2.5"
          >
            <IconRotateClockwise className="w-3.5 h-3.5" /> Restart
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isBatchProcessing}
            onClick={() => handleBatchAction('delete')}
            className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 gap-1.5 h-8 px-2.5"
          >
            <IconTrash className="w-3.5 h-3.5" /> Delete
          </Button>
          <div className="h-4 w-px bg-zinc-700" />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-zinc-400 hover:text-white h-8 px-2"
          >
            Deselect
          </Button>
        </div>
      )}

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

      {/* Create Container Modal */}
      <CreateContainerModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(id) => navigate(`/containers/${id}`)}
      />
    </div>
  );
}

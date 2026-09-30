import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useContainers, useContainerAction } from '../../hooks/use-containers';
import { useStacks } from '../../hooks/use-stacks';
import { useImages } from '../../hooks/use-images';
import { useVolumes } from '../../hooks/use-volumes';
import { useNetworks } from '../../hooks/use-networks';
import { useNodes, useHealth } from '../../hooks/use-nodes';
import { useSystemDiskUsage } from '../../hooks/use-system';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  IconBox,
  IconStack2,
  IconDisc,
  IconDatabase,
  IconNetwork,
  IconServer,
  IconTrash,
  IconPlus,
  IconPlayerPlay,
  IconPlayerStop,
  IconArrowRight,
  IconTerminal2,
} from '@tabler/icons-react';
import { SystemPruneModal } from '../system/system-prune-modal';
import { CreateStackModal } from '../stacks/create-stack-modal';
import { CreateContainerModal } from '../containers/create-container-modal';
import { PullImageModal } from '../images/pull-image-modal';
import { toast } from 'sonner';

export function DashboardView() {
  const { data: containers = [] } = useContainers();
  const { data: stacks = [] } = useStacks();
  const { data: images = [] } = useImages();
  const { data: volumes = [] } = useVolumes();
  const { data: networks = [] } = useNetworks();
  const { data: nodes = [] } = useNodes();
  const { data: health } = useHealth();
  const { data: diskUsage } = useSystemDiskUsage();

  const containerActionMutation = useContainerAction();

  // Modals state
  const [isPruneOpen, setIsPruneOpen] = useState(false);
  const [isCreateStackOpen, setIsCreateStackOpen] = useState(false);
  const [isCreateContainerOpen, setIsCreateContainerOpen] = useState(false);
  const [isPullImageOpen, setIsPullImageOpen] = useState(false);

  const localNode = nodes.find((n) => n.is_local) || nodes[0];
  const isDockerConnected = health?.docker === 'connected';

  // KPIs
  const runningContainers = containers.filter((c) => c.state === 'running').length;
  const stoppedContainers = containers.filter((c) => c.state !== 'running').length;
  const activeStacks = stacks.filter((s) => s.status === 'running').length;
  const inUseVolumes = volumes.filter((v) => v.in_use).length;
  const inUseImages = images.filter((img) => img.in_use).length;

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleContainerAction = async (id: string, action: 'start' | 'stop') => {
    try {
      await containerActionMutation.mutateAsync({ id, action });
      toast.success(`Container ${action}ed successfully`);
    } catch (err: any) {
      toast.error(`Failed to ${action} container`, { description: err.message });
    }
  };

  // Disk breakdown percentages
  const totalDisk = diskUsage?.total_size || 1;
  const imgPct = Math.round(((diskUsage?.images?.total_size || 0) / totalDisk) * 100);
  const contPct = Math.round(((diskUsage?.containers?.total_size || 0) / totalDisk) * 100);
  const volPct = Math.round(((diskUsage?.volumes?.total_size || 0) / totalDisk) * 100);
  const buildPct = Math.round(((diskUsage?.build_cache?.total_size || 0) / totalDisk) * 100);

  return (
    <div className="space-y-6">
      {/* Top Engine & Host Status Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-[#23232A] transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-[#09090B] border border-blue-200 dark:border-[#272730] flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
            <IconServer className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {localNode?.name || 'Local Docker Engine'}
              </h2>
              <Badge
                variant={isDockerConnected ? 'success' : 'destructive'}
                dot
                className="text-[10px]"
              >
                {isDockerConnected ? 'Engine Live' : 'Offline'}
              </Badge>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-3">
              <span>Docker {localNode?.docker_version || '27.x'}</span>
              <span>•</span>
              <span>{localNode?.cpu_cores || 4} CPU Cores</span>
              {localNode?.total_memory && (
                <>
                  <span>•</span>
                  <span>{(localNode.total_memory / (1024 * 1024 * 1024)).toFixed(1)} GB RAM</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsPullImageOpen(true)}
            className="gap-1.5 text-xs cursor-pointer"
          >
            <IconDisc className="w-3.5 h-3.5 text-purple-500" />
            Pull Image
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsCreateContainerOpen(true)}
            className="gap-1.5 text-xs cursor-pointer"
          >
            <IconBox className="w-3.5 h-3.5 text-emerald-500" />
            Run Container
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsCreateStackOpen(true)}
            className="gap-1.5 text-xs cursor-pointer"
          >
            <IconPlus className="w-3.5 h-3.5" />
            Deploy Stack
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Containers */}
        <Link to="/containers" className="group">
          <Card className="p-4 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase text-zinc-500">Containers</span>
              <IconBox className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                {containers.length}
              </span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                {runningContainers} running
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">
              {stoppedContainers} stopped
            </div>
          </Card>
        </Link>

        {/* Stacks */}
        <Link to="/stacks" className="group">
          <Card className="p-4 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase text-zinc-500">Stacks</span>
              <IconStack2 className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                {stacks.length}
              </span>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                {activeStacks} active
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">
              Compose apps
            </div>
          </Card>
        </Link>

        {/* Images */}
        <Link to="/images" className="group">
          <Card className="p-4 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase text-zinc-500">Images</span>
              <IconDisc className="w-4 h-4 text-purple-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                {images.length}
              </span>
              <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                {inUseImages} in use
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">
              {formatBytes(diskUsage?.images?.total_size)}
            </div>
          </Card>
        </Link>

        {/* Volumes */}
        <Link to="/volumes" className="group">
          <Card className="p-4 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase text-zinc-500">Volumes</span>
              <IconDatabase className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                {volumes.length}
              </span>
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                {inUseVolumes} mounted
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">
              {formatBytes(diskUsage?.volumes?.total_size)}
            </div>
          </Card>
        </Link>

        {/* Networks */}
        <Link to="/networks" className="group">
          <Card className="p-4 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase text-zinc-500">Networks</span>
              <IconNetwork className="w-4 h-4 text-cyan-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                {networks.length}
              </span>
              <span className="text-xs text-cyan-600 dark:text-cyan-400 font-medium">
                Active
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">
              Bridge, host, overlay
            </div>
          </Card>
        </Link>
      </div>

      {/* System Storage & Prune Section */}
      <Card className="p-5 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>Docker Storage Allocation</span>
              {diskUsage && (
                <Badge variant="outline" className="font-mono text-[10px]">
                  Total {formatBytes(diskUsage.total_size)}
                </Badge>
              )}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Live disk space consumed across images, container writable layers, volumes, and build cache.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {diskUsage && diskUsage.total_reclaimable > 0 && (
              <Badge variant="warning" className="text-xs font-mono py-1 px-2.5">
                {formatBytes(diskUsage.total_reclaimable)} Reclaimable
              </Badge>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsPruneOpen(true)}
              className="gap-1.5 text-xs cursor-pointer"
            >
              <IconTrash className="w-3.5 h-3.5" />
              Clean System
            </Button>
          </div>
        </div>

        {/* Visual Segmented Bar */}
        <div className="space-y-3">
          <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${Math.max(imgPct, 2)}%` }}
              className="bg-purple-500 h-full transition-all"
              title={`Images: ${formatBytes(diskUsage?.images?.total_size)} (${imgPct}%)`}
            />
            <div
              style={{ width: `${Math.max(volPct, 1)}%` }}
              className="bg-amber-500 h-full transition-all"
              title={`Volumes: ${formatBytes(diskUsage?.volumes?.total_size)} (${volPct}%)`}
            />
            <div
              style={{ width: `${Math.max(contPct, 1)}%` }}
              className="bg-emerald-500 h-full transition-all"
              title={`Containers: ${formatBytes(diskUsage?.containers?.total_size)} (${contPct}%)`}
            />
            <div
              style={{ width: `${Math.max(buildPct, 1)}%` }}
              className="bg-blue-500 h-full transition-all"
              title={`Build Cache: ${formatBytes(diskUsage?.build_cache?.total_size)} (${buildPct}%)`}
            />
          </div>

          {/* Breakdown legend */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-[#16161C] border border-zinc-200/60 dark:border-[#23232A]">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-zinc-500 block text-[10px]">Images</span>
                <span className="font-mono font-medium truncate block">
                  {formatBytes(diskUsage?.images?.total_size)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-[#16161C] border border-zinc-200/60 dark:border-[#23232A]">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-zinc-500 block text-[10px]">Volumes</span>
                <span className="font-mono font-medium truncate block">
                  {formatBytes(diskUsage?.volumes?.total_size)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-[#16161C] border border-zinc-200/60 dark:border-[#23232A]">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-zinc-500 block text-[10px]">Containers</span>
                <span className="font-mono font-medium truncate block">
                  {formatBytes(diskUsage?.containers?.total_size)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-[#16161C] border border-zinc-200/60 dark:border-[#23232A]">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-zinc-500 block text-[10px]">Build Cache</span>
                <span className="font-mono font-medium truncate block">
                  {formatBytes(diskUsage?.build_cache?.total_size)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Two Column Layout: Running Containers & Stacks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Containers (2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <IconBox className="w-4 h-4 text-emerald-500" />
              <span>Active Containers</span>
              <Badge variant="outline" className="text-[10px]">
                {runningContainers} running
              </Badge>
            </h3>
            <Link
              to="/containers"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              View all ({containers.length}) <IconArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-[#23232A] overflow-hidden bg-white dark:bg-[#121216] shadow-sm">
            {containers.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-500">
                No containers running on this engine.
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-[#1F1F24]">
                {containers.slice(0, 6).map((c) => {
                  const isRunning = c.state === 'running';
                  const name = c.names?.[0]?.replace(/^\//, '') || c.id.slice(0, 12);

                  return (
                    <div
                      key={c.id}
                      className="p-3.5 flex items-center justify-between hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isRunning ? 'bg-emerald-500 shadow-xs' : 'bg-zinc-400 dark:bg-zinc-600'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/containers/${c.id}`}
                              className="font-medium text-xs text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 truncate"
                            >
                              {name}
                            </Link>
                            {c.stack_name && (
                              <Badge variant="outline" className="text-[9px] font-mono px-1 py-0">
                                {c.stack_name}
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-zinc-500 truncate mt-0.5">
                            {c.image}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {c.ports && c.ports.length > 0 && (
                          <div className="hidden sm:flex items-center gap-1 font-mono text-[10px] text-zinc-500">
                            {c.ports.slice(0, 2).map((p, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                              >
                                {p.public_port ? `${p.public_port}:${p.private_port}` : p.private_port}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-1">
                          {isRunning ? (
                            <button
                              onClick={() => handleContainerAction(c.id, 'stop')}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              title="Stop container"
                            >
                              <IconPlayerStop className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleContainerAction(c.id, 'start')}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              title="Start container"
                            >
                              <IconPlayerPlay className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <Link
                            to={`/containers/${c.id}`}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            title="Inspect details"
                          >
                            <IconTerminal2 className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Active Stacks (1 col) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <IconStack2 className="w-4 h-4 text-blue-500" />
              <span>Compose Stacks</span>
              <Badge variant="outline" className="text-[10px]">
                {stacks.length}
              </Badge>
            </h3>
            <Link
              to="/stacks"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              View all <IconArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-[#23232A] overflow-hidden bg-white dark:bg-[#121216] shadow-sm divide-y divide-zinc-100 dark:divide-[#1F1F24]">
            {stacks.length === 0 ? (
              <div className="p-8 text-center">
                <IconStack2 className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-zinc-500">No stacks deployed yet.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsCreateStackOpen(true)}
                  className="mt-3 text-xs"
                >
                  Deploy First Stack
                </Button>
              </div>
            ) : (
              stacks.slice(0, 5).map((s) => (
                <Link
                  key={s.id}
                  to={`/stacks/${s.id}`}
                  className="p-3.5 block hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:text-blue-500">
                      {s.name}
                    </span>
                    <Badge
                      variant={s.status === 'running' ? 'success' : s.status === 'error' ? 'destructive' : 'neutral'}
                      className="text-[9px]"
                    >
                      {s.status}
                    </Badge>
                  </div>
                  <div className="text-[11px] font-mono text-zinc-500 truncate">
                    Deployed {new Date(s.created_at).toLocaleDateString()}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <SystemPruneModal isOpen={isPruneOpen} onClose={() => setIsPruneOpen(false)} />
      <CreateStackModal isOpen={isCreateStackOpen} onClose={() => setIsCreateStackOpen(false)} />
      <CreateContainerModal isOpen={isCreateContainerOpen} onClose={() => setIsCreateContainerOpen(false)} />
      <PullImageModal isOpen={isPullImageOpen} onClose={() => setIsPullImageOpen(false)} />
    </div>
  );
}

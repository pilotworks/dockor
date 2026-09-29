import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  IconTrash,
  IconLoader2,
  IconServer,
  IconBox,
  IconDatabase,
  IconLayersLinked,
  IconNetwork,
  IconCheck,
  IconAlertTriangle,
  IconSparkles,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { useSystemDiskUsage, useSystemPrune } from '../../hooks/use-system';
import { PruneResult } from '../../types';

interface SystemPruneModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(decimals));
  return `${val} ${sizes[i]}`;
}

export function SystemPruneModal({ isOpen, onClose }: SystemPruneModalProps) {
  const { data: diskUsage, isLoading: isUsageLoading, refetch } = useSystemDiskUsage(isOpen);
  const pruneMutation = useSystemPrune();

  const [containers, setContainers] = useState(true);
  const [images, setImages] = useState(true);
  const [volumes, setVolumes] = useState(false);
  const [networks, setNetworks] = useState(true);
  const [buildCache, setBuildCache] = useState(true);

  const [lastResult, setLastResult] = useState<PruneResult | null>(null);

  const handleRunPrune = async () => {
    try {
      const result = await pruneMutation.mutateAsync({
        containers,
        images,
        volumes,
        networks,
        build_cache: buildCache,
      });
      setLastResult(result);
      refetch();
      toast.success(
        result.space_reclaimed > 0
          ? `Cleaned up! Reclaimed ${formatBytes(result.space_reclaimed)}`
          : 'System pruned: No residual resources needed removal'
      );
    } catch (err: any) {
      toast.error('Failed to prune Docker resources', { description: err.message });
    }
  };

  const totalReclaimable = diskUsage?.total_reclaimable || 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 flex flex-col bg-white dark:bg-[#0F0F13] border-zinc-200 dark:border-[#272730] shadow-2xl rounded-2xl overflow-hidden transition-colors">
        {/* Top Header */}
        <DialogHeader className="px-6 py-4 border-b border-zinc-200 dark:border-[#1F1F24] bg-zinc-50 dark:bg-[#0A0A0D] flex flex-row items-center justify-between shrink-0 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-inner">
              <IconTrash className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Docker System Prune & Cleanup
                </DialogTitle>
                <Badge variant="warning" className="text-[10px] font-mono">
                  Garbage Collection
                </Badge>
              </div>
              <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Reclaim disk capacity from stopped containers, dangling images, and build cache
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* Current Disk Utilization Summary */}
          <div className="bg-zinc-50 dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-xl p-4 space-y-3 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Docker Storage Breakdown
              </span>
              {isUsageLoading ? (
                <span className="text-xs text-zinc-400 flex items-center gap-1">
                  <IconLoader2 className="w-3 h-3 animate-spin" /> Calculating...
                </span>
              ) : (
                <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                  {totalReclaimable > 0 ? `~${formatBytes(totalReclaimable)} reclaimable` : 'Optimized storage'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Images */}
              <div className="bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-[11px]">
                  <IconLayersLinked className="w-3.5 h-3.5 text-blue-500" />
                  <span>Images</span>
                </div>
                <div className="mt-1">
                  <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100 block">
                    {diskUsage ? formatBytes(diskUsage.images.total_size) : '--'}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {diskUsage ? `${diskUsage.images.total_count} img (${formatBytes(diskUsage.images.reclaimable)} freeable)` : ''}
                  </span>
                </div>
              </div>

              {/* Containers */}
              <div className="bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-[11px]">
                  <IconBox className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Containers</span>
                </div>
                <div className="mt-1">
                  <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100 block">
                    {diskUsage ? formatBytes(diskUsage.containers.total_size) : '--'}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {diskUsage ? `${diskUsage.containers.total_count} total (${formatBytes(diskUsage.containers.reclaimable)} freeable)` : ''}
                  </span>
                </div>
              </div>

              {/* Volumes */}
              <div className="bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-[11px]">
                  <IconDatabase className="w-3.5 h-3.5 text-amber-500" />
                  <span>Volumes</span>
                </div>
                <div className="mt-1">
                  <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100 block">
                    {diskUsage ? formatBytes(diskUsage.volumes.total_size) : '--'}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {diskUsage ? `${diskUsage.volumes.total_count} vol (${formatBytes(diskUsage.volumes.reclaimable)} freeable)` : ''}
                  </span>
                </div>
              </div>

              {/* Build Cache */}
              <div className="bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-[11px]">
                  <IconServer className="w-3.5 h-3.5 text-purple-500" />
                  <span>Build Cache</span>
                </div>
                <div className="mt-1">
                  <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100 block">
                    {diskUsage ? formatBytes(diskUsage.build_cache.total_size) : '--'}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {diskUsage ? `${diskUsage.build_cache.total_count} records` : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Clean Targets Options */}
          <div className="space-y-3">
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">
              Select Cleanup Targets:
            </span>

            <div className="space-y-2">
              {/* Containers */}
              <label className="flex items-start gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121216] cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                <input
                  type="checkbox"
                  checked={containers}
                  onChange={(e) => setContainers(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      Stopped Containers
                    </span>
                    <Badge variant="neutral" className="text-[10px] font-mono">
                      Safe
                    </Badge>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Removes all container instances that are in exited or dead states. Running containers are untouched.
                  </p>
                </div>
              </label>

              {/* Images */}
              <label className="flex items-start gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121216] cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                <input
                  type="checkbox"
                  checked={images}
                  onChange={(e) => setImages(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      Dangling & Unused Images
                    </span>
                    <Badge variant="neutral" className="text-[10px] font-mono">
                      Safe
                    </Badge>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Prunes untagged (dangling) layers and images not referenced by any existing container.
                  </p>
                </div>
              </label>

              {/* Build Cache */}
              <label className="flex items-start gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121216] cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                <input
                  type="checkbox"
                  checked={buildCache}
                  onChange={(e) => setBuildCache(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      BuildKit & Docker Build Cache
                    </span>
                    <Badge variant="neutral" className="text-[10px] font-mono">
                      Safe
                    </Badge>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Flushes builder cache layers accumulated during past image builds.
                  </p>
                </div>
              </label>

              {/* Networks */}
              <label className="flex items-start gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121216] cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                <input
                  type="checkbox"
                  checked={networks}
                  onChange={(e) => setNetworks(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                      <IconNetwork className="w-3.5 h-3.5 text-blue-500" />
                      Unused Custom Networks
                    </span>
                    <Badge variant="neutral" className="text-[10px] font-mono">
                      Safe
                    </Badge>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Removes user-defined bridge networks that have 0 active connected endpoints.
                  </p>
                </div>
              </label>

              {/* Volumes */}
              <label className="flex items-start gap-3 p-3 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 cursor-pointer hover:border-amber-300 dark:hover:border-amber-800 transition-colors">
                <input
                  type="checkbox"
                  checked={volumes}
                  onChange={(e) => setVolumes(e.target.checked)}
                  className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                      <IconAlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      Unreferenced Anonymous Volumes
                    </span>
                    <Badge variant="warning" className="text-[10px] font-mono">
                      Caution
                    </Badge>
                  </div>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-400/70 mt-0.5">
                    Prunes anonymous volumes not attached to any container. Stored persistent state in these volumes will be permanently lost.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Previous Result Banner if any */}
          {lastResult && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
                  <IconCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 block">
                    Cleanup Successful! Reclaimed {formatBytes(lastResult.space_reclaimed)}
                  </span>
                  <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                    Deleted: {lastResult.containers_deleted} containers, {lastResult.images_deleted} images, {lastResult.build_cache_deleted} cache
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-200 dark:border-[#1F1F24] bg-zinc-50 dark:bg-[#0A0A0D] flex items-center justify-between shrink-0 transition-colors">
          <Button variant="surface" size="sm" onClick={onClose}>
            Close
          </Button>

          <Button
            variant="destructive"
            size="sm"
            disabled={pruneMutation.isPending || (!containers && !images && !volumes && !networks && !buildCache)}
            onClick={handleRunPrune}
            className="gap-1.5 shadow-sm"
          >
            {pruneMutation.isPending ? (
              <IconLoader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <IconSparkles className="w-3.5 h-3.5" />
            )}
            {pruneMutation.isPending ? 'Cleaning up...' : 'Execute Prune & Reclaim Space'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

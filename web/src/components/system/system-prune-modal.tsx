import { useState, useEffect } from 'react';
import { useSystemDiskUsage, useSystemPrune } from '../../hooks/use-system';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  IconTrash,
  IconX,
  IconBox,
  IconDisc,
  IconDatabase,
  IconNetwork,
  IconCpu,
  IconAlertTriangle,
  IconCheck,
} from '@tabler/icons-react';
import { toast } from 'sonner';

interface SystemPruneModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SystemPruneModal({ isOpen, onClose }: SystemPruneModalProps) {
  const { data: usage, isLoading: isLoadingUsage } = useSystemDiskUsage(isOpen);
  const pruneMutation = useSystemPrune();

  const [pruneContainers, setPruneContainers] = useState(true);
  const [pruneImages, setPruneImages] = useState(true);
  const [pruneVolumes, setPruneVolumes] = useState(false);
  const [pruneNetworks, setPruneNetworks] = useState(true);
  const [pruneBuildCache, setPruneBuildCache] = useState(true);
  const [lastResult, setLastResult] = useState<import('../../types').PruneResult | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handlePrune = async () => {
    if (!pruneContainers && !pruneImages && !pruneVolumes && !pruneNetworks && !pruneBuildCache) {
      toast.error('Please select at least one resource category to clean');
      return;
    }

    try {
      const result = await pruneMutation.mutateAsync({
        containers: pruneContainers,
        images: pruneImages,
        volumes: pruneVolumes,
        networks: pruneNetworks,
        build_cache: pruneBuildCache,
      });
      setLastResult(result);
      toast.success('System cleanup completed successfully!', {
        description: `Freed ${formatBytes(result.space_reclaimed)} of disk space.`,
      });
    } catch (err: any) {
      toast.error('System cleanup failed', { description: err.message });
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-[#23232A] p-6 shadow-2xl space-y-5 text-zinc-900 dark:text-zinc-100 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40">
              <IconTrash className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Clean Up System Resources</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Prune stopped containers, dangling images, unused networks & build cache.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors p-1"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Disk Summary */}
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#16161C] border border-zinc-200 dark:border-[#23232A] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">Total Docker Disk Usage</span>
            <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-200">
              {isLoadingUsage ? 'Calculating...' : formatBytes(usage?.total_size)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">Total Reclaimable Space</span>
            <Badge variant="warning" className="font-mono text-[11px]">
              {isLoadingUsage ? '...' : formatBytes(usage?.total_reclaimable)}
            </Badge>
          </div>
        </div>

        {/* Checkbox Options */}
        <div className="space-y-2.5">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
            Select Resources to Prune
          </label>

          {/* Containers */}
          <label className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-[#23232A] hover:bg-zinc-50 dark:hover:bg-[#16161C] transition-colors cursor-pointer select-none">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={pruneContainers}
                onChange={(e) => setPruneContainers(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 border-zinc-300 dark:border-zinc-700 focus:ring-blue-500 cursor-pointer"
              />
              <div className="flex items-center gap-2">
                <IconBox className="w-4 h-4 text-emerald-500" />
                <div>
                  <div className="text-xs font-medium">Stopped Containers</div>
                  <div className="text-[11px] text-zinc-500">Remove all stopped or exited containers</div>
                </div>
              </div>
            </div>
            {usage?.containers && (
              <span className="text-[11px] font-mono text-zinc-500">
                {formatBytes(usage.containers.reclaimable)} reclaimable
              </span>
            )}
          </label>

          {/* Images */}
          <label className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-[#23232A] hover:bg-zinc-50 dark:hover:bg-[#16161C] transition-colors cursor-pointer select-none">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={pruneImages}
                onChange={(e) => setPruneImages(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 border-zinc-300 dark:border-zinc-700 focus:ring-blue-500 cursor-pointer"
              />
              <div className="flex items-center gap-2">
                <IconDisc className="w-4 h-4 text-purple-500" />
                <div>
                  <div className="text-xs font-medium">Dangling & Unused Images</div>
                  <div className="text-[11px] text-zinc-500">Remove untagged layer blobs & unused manifests</div>
                </div>
              </div>
            </div>
            {usage?.images && (
              <span className="text-[11px] font-mono text-zinc-500">
                {formatBytes(usage.images.reclaimable)} reclaimable
              </span>
            )}
          </label>

          {/* Build Cache */}
          <label className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-[#23232A] hover:bg-zinc-50 dark:hover:bg-[#16161C] transition-colors cursor-pointer select-none">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={pruneBuildCache}
                onChange={(e) => setPruneBuildCache(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 border-zinc-300 dark:border-zinc-700 focus:ring-blue-500 cursor-pointer"
              />
              <div className="flex items-center gap-2">
                <IconCpu className="w-4 h-4 text-blue-500" />
                <div>
                  <div className="text-xs font-medium">BuildKit Cache</div>
                  <div className="text-[11px] text-zinc-500">Remove intermediate builder layers and artifacts</div>
                </div>
              </div>
            </div>
            {usage?.build_cache && (
              <span className="text-[11px] font-mono text-zinc-500">
                {formatBytes(usage.build_cache.reclaimable)} reclaimable
              </span>
            )}
          </label>

          {/* Networks */}
          <label className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-[#23232A] hover:bg-zinc-50 dark:hover:bg-[#16161C] transition-colors cursor-pointer select-none">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={pruneNetworks}
                onChange={(e) => setPruneNetworks(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 border-zinc-300 dark:border-zinc-700 focus:ring-blue-500 cursor-pointer"
              />
              <div className="flex items-center gap-2">
                <IconNetwork className="w-4 h-4 text-cyan-500" />
                <div>
                  <div className="text-xs font-medium">Unused Networks</div>
                  <div className="text-[11px] text-zinc-500">Remove networks not referenced by any container</div>
                </div>
              </div>
            </div>
          </label>

          {/* Volumes (with warning) */}
          <label className="flex items-center justify-between p-3 rounded-xl border border-amber-200 dark:border-amber-900/30 bg-amber-50/40 dark:bg-amber-950/10 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors cursor-pointer select-none">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={pruneVolumes}
                onChange={(e) => setPruneVolumes(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 border-zinc-300 dark:border-zinc-700 focus:ring-amber-500 cursor-pointer"
              />
              <div className="flex items-center gap-2">
                <IconDatabase className="w-4 h-4 text-amber-500" />
                <div>
                  <div className="text-xs font-medium text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <span>Unused Anonymous Volumes</span>
                    <IconAlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <div className="text-[11px] text-amber-700/80 dark:text-amber-400/70">
                    Caution: Permanent loss of unattached volume data
                  </div>
                </div>
              </div>
            </div>
            {usage?.volumes && (
              <span className="text-[11px] font-mono text-amber-700 dark:text-amber-400">
                {formatBytes(usage.volumes.reclaimable)}
              </span>
            )}
          </label>
        </div>

        {/* Results banner if previously pruned */}
        {lastResult && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <IconCheck className="w-4 h-4 text-emerald-500" /> Cleanup Report
            </div>
            <div className="text-[11px] opacity-90">
              Reclaimed: <span className="font-bold">{formatBytes(lastResult.space_reclaimed)}</span> | Deleted {lastResult.containers_deleted} containers, {lastResult.images_deleted} images, {lastResult.volumes_deleted} volumes, {lastResult.networks_deleted} networks.
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-200 dark:border-[#23232A]">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={pruneMutation.isPending}>
            {lastResult ? 'Done' : 'Cancel'}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handlePrune}
            disabled={pruneMutation.isPending}
            className="gap-1.5"
          >
            <IconTrash className="w-4 h-4" />
            <span>{pruneMutation.isPending ? 'Cleaning...' : 'Prune Selected'}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

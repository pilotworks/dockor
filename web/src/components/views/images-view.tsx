import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useImages, useDeleteImage, usePruneImages } from '../../hooks/use-images';
import {
  IconDisc,
  IconDownload,
  IconSearch,
  IconTrash,
  IconCopy,
  IconCheck,
  IconBox,
  IconEraser,
  IconArrowRight,
  IconRefresh,
} from '@tabler/icons-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { PullImageModal } from '../images/pull-image-modal';
import { toast } from 'sonner';
import { confirmDialog } from '../../stores/use-dialog-store';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

export function ImagesView() {
  const { data: images = [], isLoading, refetch, isFetching } = useImages();
  const deleteMutation = useDeleteImage();
  const pruneMutation = usePruneImages();

  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'in_use' | 'unused' | 'dangling'>('all');
  const [isPullOpen, setIsPullOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

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
      setSelectedIds(new Set(filtered.map((img) => img.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;

    const confirmed = await confirmDialog({
      title: `Delete ${selectedIds.size} Image(s)`,
      description: `Are you sure you want to delete ${selectedIds.size} selected image(s)? This will force remove the images from your Docker Engine.`,
      confirmText: 'Delete Selected Images',
      variant: 'destructive',
    });
    if (!confirmed) return;

    setIsBatchProcessing(true);
    const toastId = toast.loading(`Deleting ${selectedIds.size} image(s)...`);
    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      try {
        await api.deleteImage(id, true);
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
      toast.success(`Successfully deleted ${successCount} image(s)`);
    } else {
      toast.warning(`Deleted ${successCount} image(s), ${failCount} failed (may be in-use)`);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string, inUse: boolean) => {
    const confirmed = await confirmDialog({
      title: inUse ? 'Force Delete In-Use Image' : 'Delete Image',
      description: inUse
        ? 'Warning: This image is currently being used by running or stopped containers. Force deletion may break those containers. Are you sure you want to proceed?'
        : 'Are you sure you want to delete this image? This action cannot be undone.',
      confirmText: inUse ? 'Force Delete' : 'Delete',
      variant: 'destructive',
    });

    if (confirmed) {
      try {
        await deleteMutation.mutateAsync({ id, force: inUse });
        toast.success('Image deleted successfully');
      } catch (err: any) {
        toast.error('Failed to delete image', { description: err.message });
      }
    }
  };

  const handlePrune = async (all = false) => {
    const confirmed = await confirmDialog({
      title: all ? 'Prune All Unused Images' : 'Prune Dangling Images',
      description: all
        ? 'Are you sure you want to remove all unused images from your local cache? Images will need to be re-downloaded if used later.'
        : 'Are you sure you want to prune all dangling (<none>) images? Unreferenced intermediate layers will be permanently removed.',
      confirmText: all ? 'Prune All Unused' : 'Prune Dangling',
      variant: 'destructive',
    });

    if (confirmed) {
      try {
        const res = await pruneMutation.mutateAsync(all);
        const count = res?.ImagesDeleted?.length || 0;
        toast.success(`Pruned ${count} image(s)`);
      } catch (err: any) {
        toast.error('Failed to prune images', { description: err.message });
      }
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // KPIs
  const totalInUse = useMemo(() => images.filter((img) => img.in_use).length, [images]);
  const totalUnused = useMemo(() => images.filter((img) => !img.in_use).length, [images]);
  const totalDangling = useMemo(
    () => images.filter((img) => !img.repo_tags || img.repo_tags.length === 0 || img.repo_tags[0] === '<none>:<none>').length,
    [images]
  );
  const totalDiskSize = useMemo(() => images.reduce((acc, img) => acc + (img.size || 0), 0), [images]);

  // Filtering
  const filtered = useMemo(() => {
    return images.filter((img) => {
      const isDangling = !img.repo_tags || img.repo_tags.length === 0 || img.repo_tags[0] === '<none>:<none>';
      if (filterMode === 'in_use' && !img.in_use) return false;
      if (filterMode === 'unused' && img.in_use) return false;
      if (filterMode === 'dangling' && !isDangling) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const matchId = img.id.toLowerCase().includes(q) || img.short_id.toLowerCase().includes(q);
      const matchTag = img.repo_tags?.some((t) => t.toLowerCase().includes(q));
      const matchContainers = img.used_by?.some((c) => c.name?.toLowerCase().includes(q));

      return matchId || matchTag || matchContainers;
    });
  }, [images, filterMode, search]);

  const formatDate = (unixSeconds: number) => {
    if (!unixSeconds) return 'N/A';
    try {
      const date = new Date(unixSeconds * 1000);
      const now = new Date();
      const diffDays = Math.round((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 30) return `${diffDays} days ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-[#23232A] rounded-xl p-4 transition-colors">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <IconDisc className="w-4 h-4 text-purple-500" />
            <span>Container Images</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Manage local image cache, pull container images from registries, inspect layers, and purge dangling blobs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5"
            title="Refresh"
          >
            <IconRefresh className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => handlePrune(false)}
            disabled={pruneMutation.isPending || totalDangling === 0}
            className="gap-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 border-amber-200 dark:border-amber-900/40"
          >
            <IconEraser className="w-3.5 h-3.5" />
            Prune Dangling ({totalDangling})
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsPullOpen(true)}
            className="gap-1.5"
          >
            <IconDownload className="w-3.5 h-3.5" />
            Pull Image
          </Button>
        </div>
      </div>

      {/* KPI Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
            Total Images
          </span>
          <div className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {images.length}
          </div>
          <span className="text-[11px] text-zinc-500 mt-1 block">Local cache entries</span>
        </Card>

        <Card className="p-3.5 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-purple-500 block mb-1">
            Cache Footprint
          </span>
          <div className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {formatBytes(totalDiskSize)}
          </div>
          <span className="text-[11px] text-zinc-500 mt-1 block">Uncompressed size</span>
        </Card>

        <Card className="p-3.5 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-emerald-500 block mb-1">
            In-Use Images
          </span>
          <div className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {totalInUse}
          </div>
          <span className="text-[11px] text-zinc-500 mt-1 block">Backed by containers</span>
        </Card>

        <Card className="p-3.5 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-amber-500 block mb-1">
            Dangling Blobs
          </span>
          <div className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {totalDangling}
          </div>
          <span className="text-[11px] text-zinc-500 mt-1 block">Untagged layers</span>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-zinc-200 dark:border-[#23232A] bg-zinc-100/80 dark:bg-[#141418] p-0.5">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              All ({images.length})
            </button>
            <button
              onClick={() => setFilterMode('in_use')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                filterMode === 'in_use'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              In Use ({totalInUse})
            </button>
            <button
              onClick={() => setFilterMode('unused')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                filterMode === 'unused'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Unused ({totalUnused})
            </button>
            <button
              onClick={() => setFilterMode('dangling')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                filterMode === 'dangling'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Dangling ({totalDangling})
            </button>
          </div>

          {totalDangling > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handlePrune(false)}
              className="h-7 text-xs text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/30 gap-1.5 px-2.5"
            >
              <IconEraser className="w-3.5 h-3.5" />
              <span>Clean Dangling ({totalDangling})</span>
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <IconSearch className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <Input
            placeholder="Search tags, image IDs, containers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>
      </div>

      {/* Images Table */}
      <div className="border border-zinc-200 dark:border-[#23232A] rounded-xl overflow-hidden bg-white dark:bg-[#121216] shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-[#15151A] border-b border-zinc-200 dark:border-[#23232A] text-zinc-500 dark:text-zinc-400 font-medium">
              <tr>
                <th className="py-2.5 px-3 w-9 text-center">
                  <div className="flex items-center justify-center">
                    <Checkbox
                      size="sm"
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      indeterminate={selectedIds.size > 0 && selectedIds.size < filtered.length}
                      onChange={toggleSelectAll}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 font-semibold">Repository & Tags</th>
                <th className="py-2.5 px-3 font-semibold">Image ID</th>
                <th className="py-2.5 px-3 font-semibold">Size</th>
                <th className="py-2.5 px-3 font-semibold">Containers</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 font-semibold">Created</th>
                <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-[#1C1C22]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-400">
                    Loading image manifests...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <IconDisc className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
                    <p className="text-zinc-500 font-medium">No images found</p>
                    <p className="text-zinc-400 text-[11px] mt-0.5">
                      {search ? 'Try adjusting your search criteria' : 'Pull a new image to get started'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((img) => {
                  const hasTags = img.repo_tags && img.repo_tags.length > 0 && img.repo_tags[0] !== '<none>:<none>';
                  const primaryTag = hasTags ? img.repo_tags[0] : '<none>:<none>';
                  const isSelected = selectedIds.has(img.id);

                  return (
                    <tr
                      key={img.id}
                      className={cn(
                        'hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors group',
                        isSelected && 'bg-blue-50/50 dark:bg-blue-950/20'
                      )}
                    >
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center">
                          <Checkbox
                            size="sm"
                            checked={isSelected}
                            onChange={(e) => toggleSelect(img.id, e as any)}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/images/${img.short_id || encodeURIComponent(img.id)}`}
                            className="font-mono font-medium text-zinc-900 dark:text-zinc-100 hover:text-purple-600 dark:hover:text-purple-400 text-left transition-colors cursor-pointer truncate max-w-xs"
                          >
                            {primaryTag}
                          </Link>
                          {hasTags && (
                            <button
                              onClick={() => copyToClipboard(primaryTag, img.id)}
                              className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-opacity p-0.5"
                              title="Copy image tag"
                            >
                              {copiedId === img.id ? (
                                <IconCheck className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <IconCopy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                        {img.repo_tags && img.repo_tags.length > 1 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {img.repo_tags.slice(1).map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px] text-zinc-500">
                        {img.short_id}
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                        {formatBytes(img.size)}
                      </td>

                      <td className="py-3 px-3">
                        {img.used_by && img.used_by.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {img.used_by.map((c) => (
                              <Link
                                key={c.id}
                                to={`/containers/${c.id}`}
                                className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                              >
                                <IconBox className="w-2.5 h-2.5" />
                                <span>{c.name || c.id.substring(0, 8)}</span>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <span className="text-zinc-400 text-[11px] italic">0</span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <Badge variant={img.in_use ? 'success' : 'neutral'} dot>
                          {img.in_use ? 'In Use' : 'Unused'}
                        </Badge>
                      </td>

                      <td className="py-3 px-3 text-zinc-500 font-mono text-[11px]">
                        {formatDate(img.created)}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link to={`/images/${encodeURIComponent(img.id)}`}>
                            <Button
                              size="xs"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="View details"
                            >
                              <IconArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                            </Button>
                          </Link>

                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => handleDelete(img.id, img.in_use)}
                            className="h-7 w-7 p-0 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                            title="Delete image"
                          >
                            <IconTrash className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
            onClick={handleBatchDelete}
            className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 gap-1.5 h-8 px-2.5"
          >
            <IconTrash className="w-3.5 h-3.5" /> Delete Selected
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

      {/* Pull Modal */}
      <PullImageModal
        isOpen={isPullOpen}
        onClose={() => setIsPullOpen(false)}
      />
    </div>
  );
}

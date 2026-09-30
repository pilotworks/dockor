import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useVolumes, useDeleteVolume, usePruneVolumes } from '../../hooks/use-volumes';
import {
  IconDatabase,
  IconPlus,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { CreateVolumeModal } from '../volumes/create-volume-modal';
import { toast } from 'sonner';
import { confirmDialog } from '../../stores/use-dialog-store';

export function VolumesView() {
  const { data: volumes = [], isLoading, refetch, isFetching } = useVolumes();
  const deleteMutation = useDeleteVolume();
  const pruneMutation = usePruneVolumes();

  const [search, setSearch] = useState('');
  const [usageFilter, setUsageFilter] = useState<'all' | 'in_use' | 'unused'>('all');
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedName(id);
    toast.success('Copied volume name to clipboard');
    setTimeout(() => setCopiedName(null), 2000);
  };

  const handleDelete = async (name: string, inUse: boolean) => {
    const confirmed = await confirmDialog({
      title: inUse ? 'Force Delete In-Use Volume' : 'Delete Volume',
      description: inUse
        ? `Warning: Volume "${name}" is currently mounted to one or more containers. Force deletion may cause data loss or container failures. Are you sure you want to proceed?`
        : `Are you sure you want to delete volume "${name}"? This action cannot be undone.`,
      confirmText: inUse ? 'Force Delete' : 'Delete',
      variant: 'destructive',
    });

    if (confirmed) {
      try {
        await deleteMutation.mutateAsync({ name, force: inUse });
        toast.success(`Volume "${name}" deleted`);
      } catch (err: any) {
        toast.error('Failed to delete volume', { description: err.message });
      }
    }
  };

  const handlePrune = async () => {
    const confirmed = await confirmDialog({
      title: 'Prune Unused Volumes',
      description: 'Are you sure you want to prune all unused volumes? All persistent data stored in unattached volumes will be permanently removed.',
      confirmText: 'Prune Volumes',
      variant: 'destructive',
    });

    if (confirmed) {
      try {
        const res = await pruneMutation.mutateAsync();
        const deletedCount = res?.VolumesDeleted?.length || 0;
        toast.success(`Pruned ${deletedCount} unused volume(s)`);
      } catch (err: any) {
        toast.error('Failed to prune volumes', { description: err.message });
      }
    }
  };

  // KPIs
  const totalInUse = useMemo(() => volumes.filter((v) => v.in_use).length, [volumes]);
  const totalUnused = useMemo(() => volumes.filter((v) => !v.in_use).length, [volumes]);
  const drivers = useMemo(() => ['all', ...new Set(volumes.map((v) => v.driver).filter(Boolean))], [volumes]);

  // Filtering
  const filtered = useMemo(() => {
    return volumes.filter((v) => {
      if (usageFilter === 'in_use' && !v.in_use) return false;
      if (usageFilter === 'unused' && v.in_use) return false;
      if (driverFilter !== 'all' && v.driver !== driverFilter) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const matchName = v.name.toLowerCase().includes(q);
      const matchDriver = v.driver.toLowerCase().includes(q);
      const matchMount = v.mountpoint?.toLowerCase().includes(q);
      const matchContainer = v.containers?.some((c) => c.name?.toLowerCase().includes(q));

      return matchName || matchDriver || matchMount || matchContainer;
    });
  }, [volumes, usageFilter, driverFilter, search]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-[#23232A] rounded-xl p-4 transition-colors">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <IconDatabase className="w-4 h-4 text-blue-500" />
            <span>Persistent Volumes</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Manage Docker storage volumes, inspect host mountpoints, and safely reclaim unmounted storage.
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
            onClick={handlePrune}
            disabled={pruneMutation.isPending || totalUnused === 0}
            className="gap-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 border-amber-200 dark:border-amber-900/40"
          >
            <IconEraser className="w-3.5 h-3.5" />
            Prune Unused ({totalUnused})
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsCreateOpen(true)}
            className="gap-1.5"
          >
            <IconPlus className="w-3.5 h-3.5" />
            Create Volume
          </Button>
        </div>
      </div>

      {/* KPI Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
            Total Volumes
          </span>
          <div className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {volumes.length}
          </div>
          <span className="text-[11px] text-zinc-500 mt-1 block">Storage units</span>
        </Card>

        <Card className="p-3.5 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-emerald-500 block mb-1">
            In-Use Volumes
          </span>
          <div className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {totalInUse}
          </div>
          <span className="text-[11px] text-zinc-500 mt-1 block">Active attachments</span>
        </Card>

        <Card className="p-3.5 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-amber-500 block mb-1">
            Unused Volumes
          </span>
          <div className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {totalUnused}
          </div>
          <span className="text-[11px] text-zinc-500 mt-1 block">Reclaimable units</span>
        </Card>

        <Card className="p-3.5 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
            Storage Drivers
          </span>
          <div className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {drivers.length - 1}
          </div>
          <span className="text-[11px] text-zinc-500 mt-1 block">Local & volume plugins</span>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Usage Filter Pills */}
          <div className="inline-flex rounded-lg border border-zinc-200 dark:border-[#23232A] bg-zinc-100/80 dark:bg-[#141418] p-0.5">
            <button
              onClick={() => setUsageFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                usageFilter === 'all'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              All ({volumes.length})
            </button>
            <button
              onClick={() => setUsageFilter('in_use')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                usageFilter === 'in_use'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              In Use ({totalInUse})
            </button>
            <button
              onClick={() => setUsageFilter('unused')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                usageFilter === 'unused'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Unused ({totalUnused})
            </button>
          </div>

          {/* Driver Filter if multiple */}
          {drivers.length > 2 && (
            <Select value={driverFilter} onValueChange={setDriverFilter}>
              <SelectTrigger className="h-8 text-xs w-[140px] bg-white dark:bg-[#141418] border-zinc-200 dark:border-[#23232A]">
                <SelectValue placeholder="Driver" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((d) => (
                  <SelectItem key={d} value={d}>
                    Driver: {d === 'all' ? 'All' : d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <IconSearch className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <Input
            placeholder="Search volumes or containers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>
      </div>

      {/* Volumes Table */}
      <div className="border border-zinc-200 dark:border-[#23232A] rounded-xl overflow-hidden bg-white dark:bg-[#121216] shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-[#15151A] border-b border-zinc-200 dark:border-[#23232A] text-zinc-500 dark:text-zinc-400 font-medium">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Volume Name</th>
                <th className="py-2.5 px-3 font-semibold">Driver</th>
                <th className="py-2.5 px-3 font-semibold">Mounted Containers</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 font-semibold">Created</th>
                <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-[#1C1C22]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-400">
                    Loading volume manifests...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <IconDatabase className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
                    <p className="text-zinc-500 font-medium">No volumes found</p>
                    <p className="text-zinc-400 text-[11px] mt-0.5">
                      {search ? 'Try adjusting your search criteria' : 'Create a new volume to get started'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((vol) => (
                  <tr
                    key={vol.name}
                    className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/volumes/${encodeURIComponent(vol.name)}`}
                          className="font-mono font-medium text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 text-left transition-colors cursor-pointer"
                        >
                          {vol.name}
                        </Link>
                        <button
                          onClick={() => copyToClipboard(vol.name, vol.name)}
                          className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-opacity p-0.5"
                          title="Copy volume name"
                        >
                          {copiedName === vol.name ? (
                            <IconCheck className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <IconCopy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <div className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono truncate max-w-xs mt-0.5" title={vol.mountpoint}>
                        {vol.mountpoint || 'local'}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                        {vol.driver}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      {vol.containers && vol.containers.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {vol.containers.map((c) => (
                            <Link
                              key={c.id}
                              to={`/containers/${c.id}`}
                              className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                            >
                              <IconBox className="w-2.5 h-2.5" />
                              <span>{c.name || c.id.substring(0, 8)}</span>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-400 text-[11px] italic">None</span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <Badge variant={vol.in_use ? 'success' : 'neutral'} dot>
                        {vol.in_use ? 'In Use' : 'Unused'}
                      </Badge>
                    </td>

                    <td className="py-3 px-3 text-zinc-500 font-mono text-[11px]">
                      {formatDate(vol.created_at)}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link to={`/volumes/${encodeURIComponent(vol.name)}`}>
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
                          onClick={() => handleDelete(vol.name, vol.in_use)}
                          className="h-7 w-7 p-0 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                          title="Delete volume"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      <CreateVolumeModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  );
}

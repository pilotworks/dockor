import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useVolume, useDeleteVolume } from '../../hooks/use-volumes';
import {
  IconArrowLeft,
  IconDatabase,
  IconTrash,
  IconCopy,
  IconCheck,
  IconBox,
  IconFolder,
  IconRefresh,
  IconCode,
  IconServer,
  IconTags,
  IconAdjustments,
} from '@tabler/icons-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { JsonViewer } from '../editor/json-viewer';
import { toast } from 'sonner';
import { confirmDialog } from '../../stores/use-dialog-store';
import { useTabQuery } from '../../hooks/use-tab-query';

const VOLUME_TABS = ['overview', 'containers', 'inspect'] as const;

export function VolumeDetailView() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();

  const decodedName = name ? decodeURIComponent(name) : '';
  const { data: volume, isLoading, error, refetch, isFetching } = useVolume(decodedName);
  const deleteMutation = useDeleteVolume();

  const [activeTab, setActiveTab] = useTabQuery(VOLUME_TABS, 'overview');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDelete = async () => {
    if (!volume) return;

    const confirmed = await confirmDialog({
      title: volume.in_use ? 'Force Delete In-Use Volume' : 'Delete Volume',
      description: volume.in_use
        ? `Warning: Volume "${volume.name}" is currently mounted to one or more containers. Force deletion may cause data loss or container failures. Are you sure you want to proceed?`
        : `Are you sure you want to delete volume "${volume.name}"? This action cannot be undone.`,
      confirmText: volume.in_use ? 'Force Delete' : 'Delete',
      variant: 'destructive',
    });

    if (confirmed) {
      setIsDeleting(true);
      try {
        await deleteMutation.mutateAsync({ name: volume.name, force: volume.in_use });
        toast.success(`Volume "${volume.name}" deleted`);
        navigate('/volumes');
      } catch (err: any) {
        toast.error('Failed to delete volume', { description: err.message });
        setIsDeleting(false);
      }
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-xs text-zinc-500">
        Loading volume details...
      </div>
    );
  }

  if (error || !volume) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/volumes')} className="gap-1.5 text-xs">
          <IconArrowLeft className="w-4 h-4" /> Back to Volumes
        </Button>
        <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-xs text-red-700 dark:text-red-300">
          Failed to load volume: {(error as Error)?.message || 'Volume not found'}
        </div>
      </div>
    );
  }

  const containersCount = volume.containers?.length || 0;

  return (
    <div className="space-y-5 pb-10">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/volumes')}
          className="gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <IconArrowLeft className="w-4 h-4" />
          <span>Volumes</span>
        </Button>
        <span className="text-zinc-400">/</span>
        <span className="text-xs font-mono text-zinc-500 truncate max-w-sm">{volume.name}</span>
      </div>

      {/* Top Banner / Hero Header */}
      <div className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-2xl p-5 shadow-xs transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
              <IconDatabase className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg font-bold font-mono text-zinc-900 dark:text-white tracking-tight">
                  {volume.name}
                </h1>
                <button
                  onClick={() => copyToClipboard(volume.name, 'name')}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Copy volume name"
                >
                  {copiedKey === 'name' ? (
                    <IconCheck className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <IconCopy className="w-3.5 h-3.5" />
                  )}
                </button>
                <Badge variant={volume.in_use ? 'success' : 'neutral'} dot>
                  {volume.in_use ? 'In Use' : 'Unused'}
                </Badge>
              </div>

              <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex-wrap">
                <span>Driver: <strong className="font-mono text-zinc-700 dark:text-zinc-300">{volume.driver}</strong></span>
                <span>•</span>
                <span>Scope: <strong className="font-mono text-zinc-700 dark:text-zinc-300">{volume.scope || 'local'}</strong></span>
                <span>•</span>
                <span>Attachments: <strong>{containersCount} container(s)</strong></span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1.5"
            >
              <IconRefresh className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/40 gap-1.5"
            >
              <IconTrash className="w-3.5 h-3.5" />
              {isDeleting ? 'Deleting...' : 'Delete Volume'}
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] shadow-xs">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
            Driver Engine
          </span>
          <div className="text-base font-bold font-mono text-zinc-900 dark:text-zinc-100 truncate">
            {volume.driver}
          </div>
          <span className="text-[11px] text-zinc-500 mt-0.5 block">Storage plugin</span>
        </Card>

        <Card className="p-3.5 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] shadow-xs">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
            Scope
          </span>
          <div className="text-base font-bold font-mono text-zinc-900 dark:text-zinc-100 uppercase">
            {volume.scope || 'LOCAL'}
          </div>
          <span className="text-[11px] text-zinc-500 mt-0.5 block">Host-level namespace</span>
        </Card>

        <Card className="p-3.5 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] shadow-xs">
          <span className="text-[10px] uppercase font-semibold text-emerald-500 block mb-1">
            Attached Containers
          </span>
          <div className="text-base font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {containersCount}
          </div>
          <span className="text-[11px] text-zinc-500 mt-0.5 block">Active mounts</span>
        </Card>

        <Card className="p-3.5 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] shadow-xs">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
            Created Date
          </span>
          <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
            {formatDate(volume.created_at)}
          </div>
          <span className="text-[11px] text-zinc-500 mt-0.5 block">Provision timestamp</span>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} variant="line">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <IconServer className="w-3.5 h-3.5" />
            <span>Overview & Storage</span>
          </TabsTrigger>

          <TabsTrigger value="containers" className="gap-1.5">
            <IconBox className="w-3.5 h-3.5" />
            <span>Mounted Containers</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {containersCount}
            </span>
          </TabsTrigger>

          <TabsTrigger value="inspect" className="gap-1.5">
            <IconCode className="w-3.5 h-3.5" />
            <span>Inspect JSON</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Contents */}
        <TabsContent value="overview" className="mt-4">
          <div className="space-y-4">
            {/* Host Mount Path Card */}
            <div className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-2xl p-5 shadow-xs">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block mb-1">
                Host FileSystem Path
              </span>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                Absolute storage location on the Docker host daemon filesystem.
              </p>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-xs text-zinc-800 dark:text-zinc-200 select-all">
                <IconFolder className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="flex-1 break-all">{volume.mountpoint || 'N/A'}</span>
                <button
                  onClick={() => copyToClipboard(volume.mountpoint, 'mountpoint')}
                  className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors shrink-0"
                  title="Copy host path"
                >
                  {copiedKey === 'mountpoint' ? (
                    <IconCheck className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <IconCopy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Labels & Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Labels Card */}
              <div className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-2xl p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <IconTags className="w-4 h-4 text-zinc-500" />
                  <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Metadata Labels</h3>
                </div>
                {volume.labels && Object.keys(volume.labels).length > 0 ? (
                  <div className="space-y-1.5">
                    {Object.entries(volume.labels).map(([k, v]) => (
                      <div
                        key={k}
                        className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono flex items-center justify-between gap-2"
                      >
                        <span className="font-semibold text-zinc-600 dark:text-zinc-400">{k}</span>
                        <span className="text-zinc-900 dark:text-zinc-200 truncate">{v}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">No labels configured on this volume.</p>
                )}
              </div>

              {/* Driver Options Card */}
              <div className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-2xl p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <IconAdjustments className="w-4 h-4 text-zinc-500" />
                  <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Driver Options</h3>
                </div>
                {volume.options && Object.keys(volume.options).length > 0 ? (
                  <div className="space-y-1.5">
                    {Object.entries(volume.options).map(([k, v]) => (
                      <div
                        key={k}
                        className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono flex items-center justify-between gap-2"
                      >
                        <span className="font-semibold text-zinc-600 dark:text-zinc-400">{k}</span>
                        <span className="text-zinc-900 dark:text-zinc-200 truncate">{v}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">No custom driver options configured.</p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="containers" className="mt-4">
          <div className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-zinc-200 dark:border-[#23232A] flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Containers Mounting This Volume</h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Containers with persistent bindings to this storage resource</p>
              </div>
            </div>

            {containersCount === 0 ? (
              <div className="py-16 text-center">
                <IconBox className="w-9 h-9 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
                <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">No Containers Attached</h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">This volume is currently unused and can be safely pruned.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-zinc-50 dark:bg-[#15151A] border-b border-zinc-200 dark:border-[#23232A] text-zinc-500 font-medium">
                  <TableRow>
                    <TableHead className="py-2.5 px-4 font-semibold text-zinc-500 dark:text-zinc-400">Container Name</TableHead>
                    <TableHead className="py-2.5 px-3 font-semibold text-zinc-500 dark:text-zinc-400">State</TableHead>
                    <TableHead className="py-2.5 px-3 font-semibold text-zinc-500 dark:text-zinc-400">Container Mount Path</TableHead>
                    <TableHead className="py-2.5 px-3 font-semibold text-zinc-500 dark:text-zinc-400">Access Mode</TableHead>
                    <TableHead className="py-2.5 px-4 font-semibold text-right text-zinc-500 dark:text-zinc-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-zinc-100 dark:divide-[#1C1C22]">
                  {volume.containers.map((c) => (
                    <TableRow key={c.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors">
                      <TableCell className="py-3 px-4">
                        <Link
                          to={`/containers/${c.id}`}
                          className="font-mono font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5"
                        >
                          <IconBox className="w-3.5 h-3.5 shrink-0" />
                          <span>{c.name || c.id.substring(0, 12)}</span>
                        </Link>
                      </TableCell>

                      <TableCell className="py-3 px-3">
                        <Badge
                          variant={c.state === 'running' ? 'success' : 'neutral'}
                          dot
                          className="text-[10px] px-1.5 py-0"
                        >
                          {c.state}
                        </Badge>
                      </TableCell>

                      <TableCell className="py-3 px-3 font-mono text-zinc-800 dark:text-zinc-200">
                        {c.destination}
                      </TableCell>

                      <TableCell className="py-3 px-3">
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                          {c.rw ? 'Read-Write (rw)' : 'Read-Only (ro)'}
                        </span>
                      </TableCell>

                      <TableCell className="py-3 px-4 text-right">
                        <Link to={`/containers/${c.id}`}>
                          <Button size="xs" variant="outline" className="text-xs">
                            View Container
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="inspect" className="mt-4">
          <div className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-2xl p-5 shadow-xs">
            <JsonViewer data={volume} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

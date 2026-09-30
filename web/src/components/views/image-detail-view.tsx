import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useImage, useImages, useDeleteImage } from '../../hooks/use-images';
import {
  IconArrowLeft,
  IconDisc,
  IconTrash,
  IconCopy,
  IconCheck,
  IconBox,
  IconRefresh,
  IconCode,
  IconLayersLinked,
  IconFileText,
  IconServer,
  IconSearch,
  IconTag,
  IconUpload,
  IconPlus,
} from '@tabler/icons-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
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
import { TagImageModal } from '../images/tag-image-modal';
import { PushImageModal } from '../images/push-image-modal';
import { useTabQuery } from '../../hooks/use-tab-query';

const IMAGE_TABS = ['overview', 'containers', 'env', 'layers', 'inspect'] as const;

export function ImageDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const decodedId = id ? decodeURIComponent(id) : '';
  const { data: inspectData, isLoading, error, refetch, isFetching } = useImage(decodedId);
  const { data: allImages = [] } = useImages();
  const deleteMutation = useDeleteImage();

  const [activeTab, setActiveTab] = useTabQuery(IMAGE_TABS, 'overview');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTagOpen, setIsTagOpen] = useState(false);
  const [isPushOpen, setIsPushOpen] = useState(false);
  const [envSearch, setEnvSearch] = useState('');

  // Find corresponding summary item for container attachments
  const summaryItem = useMemo(() => {
    return allImages.find(
      (img) =>
        img.id === decodedId ||
        img.short_id === decodedId ||
        img.repo_tags?.includes(decodedId) ||
        decodedId.includes(img.short_id) ||
        (inspectData?.Id && img.id === inspectData.Id)
    );
  }, [allImages, decodedId, inspectData]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDelete = async () => {
    if (!decodedId) return;

    const inUse = summaryItem?.in_use ?? false;
    const confirmed = await confirmDialog({
      title: inUse ? 'Force Delete In-Use Image' : 'Delete Image',
      description: inUse
        ? 'Warning: This image is currently being used by running or stopped containers. Force deletion may break those containers. Are you sure you want to proceed?'
        : 'Are you sure you want to delete this image? This action cannot be undone.',
      confirmText: inUse ? 'Force Delete' : 'Delete',
      variant: 'destructive',
    });

    if (confirmed) {
      setIsDeleting(true);
      try {
        await deleteMutation.mutateAsync({ id: decodedId, force: inUse });
        toast.success('Image deleted successfully');
        navigate('/images');
      } catch (err: any) {
        toast.error('Failed to delete image', { description: err.message });
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
        Loading image details...
      </div>
    );
  }

  if (error || !inspectData) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/images')} className="gap-1.5 text-xs">
          <IconArrowLeft className="w-4 h-4" /> Back to Images
        </Button>
        <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-xs text-red-700 dark:text-red-300">
          Failed to load image: {(error as Error)?.message || 'Image not found'}
        </div>
      </div>
    );
  }

  const tags = inspectData.RepoTags || summaryItem?.repo_tags || [];
  const primaryTag = tags.length > 0 && tags[0] !== '<none>:<none>' ? tags[0] : inspectData.Id.substring(0, 19);
  const shortId = inspectData.Id.startsWith('sha256:')
    ? inspectData.Id.substring(7, 19)
    : inspectData.Id.substring(0, 12);
  const usedByContainers = summaryItem?.used_by || [];
  const inUse = summaryItem?.in_use ?? (usedByContainers.length > 0);

  const envList = inspectData.Config?.Env || [];
  const filteredEnv = envList.filter((e) => e.toLowerCase().includes(envSearch.toLowerCase()));

  return (
    <div className="space-y-5 pb-10">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/images')}
          className="gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <IconArrowLeft className="w-4 h-4" />
          <span>Images</span>
        </Button>
        <span className="text-zinc-400">/</span>
        <span className="text-xs font-mono text-zinc-500 truncate max-w-sm">{primaryTag}</span>
      </div>

      {/* Top Banner / Hero Header */}
      <div className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-2xl p-5 shadow-xs transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/40 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
              <IconDisc className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg font-bold font-mono text-zinc-900 dark:text-white tracking-tight">
                  {primaryTag}
                </h1>
                <button
                  onClick={() => copyToClipboard(primaryTag, 'tag')}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Copy image tag"
                >
                  {copiedKey === 'tag' ? (
                    <IconCheck className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <IconCopy className="w-3.5 h-3.5" />
                  )}
                </button>
                <Badge variant={inUse ? 'success' : 'neutral'} dot>
                  {inUse ? 'In Use' : 'Unused'}
                </Badge>
              </div>

              <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex-wrap">
                <span>ID: <strong className="font-mono text-zinc-700 dark:text-zinc-300">{shortId}</strong></span>
                <span>•</span>
                <span>Arch: <strong className="font-mono text-zinc-700 dark:text-zinc-300">{inspectData.Architecture}</strong></span>
                <span>•</span>
                <span>Virtual Size: <strong>{formatBytes(inspectData.Size)}</strong></span>
                <span>•</span>
                <span>Containers: <strong>{usedByContainers.length}</strong></span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTagOpen(true)}
              className="gap-1.5 text-xs text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60 hover:bg-purple-50 dark:hover:bg-purple-950/30"
            >
              <IconTag className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Add Tag</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPushOpen(true)}
              className="gap-1.5 text-xs text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60 hover:bg-blue-50 dark:hover:bg-blue-950/30"
            >
              <IconUpload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Push</span>
            </Button>

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
              {isDeleting ? 'Deleting...' : 'Delete Image'}
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] shadow-xs">
          <span className="text-[10px] uppercase font-semibold text-purple-500 block mb-1">
            Virtual Image Size
          </span>
          <div className="text-base font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {formatBytes(inspectData.Size)}
          </div>
          <span className="text-[11px] text-zinc-500 mt-0.5 block">Layers & unpacked rootfs</span>
        </Card>

        <Card className="p-3.5 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] shadow-xs">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
            Architecture / OS
          </span>
          <div className="text-base font-bold font-mono text-zinc-900 dark:text-zinc-100 truncate">
            {inspectData.Architecture} / {inspectData.Os}
          </div>
          <span className="text-[11px] text-zinc-500 mt-0.5 block">Platform target</span>
        </Card>

        <Card className="p-3.5 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] shadow-xs">
          <span className="text-[10px] uppercase font-semibold text-emerald-500 block mb-1">
            Running Containers
          </span>
          <div className="text-base font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {usedByContainers.length}
          </div>
          <span className="text-[11px] text-zinc-500 mt-0.5 block">Active references</span>
        </Card>

        <Card className="p-3.5 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] shadow-xs">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
            Created Date
          </span>
          <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
            {formatDate(inspectData.Created)}
          </div>
          <span className="text-[11px] text-zinc-500 mt-0.5 block">Build timestamp</span>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} variant="line">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <IconServer className="w-3.5 h-3.5" />
            <span>Overview & Config</span>
          </TabsTrigger>

          <TabsTrigger value="containers" className="gap-1.5">
            <IconBox className="w-3.5 h-3.5" />
            <span>Containers ({usedByContainers.length})</span>
          </TabsTrigger>

          <TabsTrigger value="env" className="gap-1.5">
            <IconFileText className="w-3.5 h-3.5" />
            <span>Environment ({envList.length})</span>
          </TabsTrigger>

          <TabsTrigger value="layers" className="gap-1.5">
            <IconLayersLinked className="w-3.5 h-3.5" />
            <span>RootFS Layers ({inspectData.RootFS?.Layers?.length || 0})</span>
          </TabsTrigger>

          <TabsTrigger value="inspect" className="gap-1.5">
            <IconCode className="w-3.5 h-3.5" />
            <span>Inspect JSON</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Contents */}
        <TabsContent value="overview" className="mt-4">
          <div className="space-y-4">
          {/* Full ID Card */}
          <div className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-2xl p-5 shadow-xs">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block mb-1">
              Content-Addressable Digest & Full ID
            </span>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-xs text-zinc-800 dark:text-zinc-200 select-all">
              <span className="flex-1 break-all">{inspectData.Id}</span>
              <button
                onClick={() => copyToClipboard(inspectData.Id, 'id')}
                className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors shrink-0"
                title="Copy Full ID"
              >
                {copiedKey === 'id' ? <IconCheck className="w-4 h-4 text-emerald-500" /> : <IconCopy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Repo Tags */}
          <div className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Repository Tags
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsTagOpen(true)}
                className="h-7 px-2.5 text-[11px] gap-1 rounded-lg"
              >
                <IconPlus className="w-3 h-3 text-purple-500" />
                <span>Add Tag</span>
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.length > 0 ? (
                tags.map((t) => (
                  <div
                    key={t}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 text-purple-700 dark:text-purple-300 font-mono text-xs"
                  >
                    <span>{t}</span>
                    <button
                      onClick={() => copyToClipboard(t, `tag-${t}`)}
                      className="text-purple-400 hover:text-purple-700 dark:hover:text-purple-200"
                      title="Copy Tag"
                    >
                      {copiedKey === `tag-${t}` ? (
                        <IconCheck className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <IconCopy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                ))
              ) : (
                <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">&lt;none&gt;:&lt;none&gt; (Dangling image)</span>
              )}
            </div>
          </div>

          {/* Configuration Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Commands Card */}
            <div className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Execution Commands</h3>

              <div>
                <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider block mb-1">
                  Entrypoint
                </span>
                {inspectData.Config?.Entrypoint && inspectData.Config.Entrypoint.length > 0 ? (
                  <pre className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-200 overflow-x-auto">
                    {inspectData.Config.Entrypoint.join(' ')}
                  </pre>
                ) : (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">No entrypoint declared</p>
                )}
              </div>

              <div>
                <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider block mb-1">
                  Default CMD
                </span>
                {inspectData.Config?.Cmd && inspectData.Config.Cmd.length > 0 ? (
                  <pre className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-200 overflow-x-auto">
                    {inspectData.Config.Cmd.join(' ')}
                  </pre>
                ) : (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">No command declared</p>
                )}
              </div>
            </div>

            {/* Container Environment Settings */}
            <div className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Runtime Parameters</h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-0.5">Working Dir</span>
                  <span className="font-mono text-zinc-800 dark:text-zinc-200">{inspectData.Config?.WorkingDir || '/'}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-0.5">User</span>
                  <span className="font-mono text-zinc-800 dark:text-zinc-200">{inspectData.Config?.User || 'root'}</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider block mb-1">
                  Exposed Ports
                </span>
                {inspectData.Config?.ExposedPorts && Object.keys(inspectData.Config.ExposedPorts).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(inspectData.Config.ExposedPorts).map((p) => (
                      <span
                        key={p}
                        className="px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono text-xs border border-zinc-200 dark:border-zinc-700"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">None exposed</p>
                )}
              </div>
            </div>
          </div>
          </div>
        </TabsContent>

        <TabsContent value="containers" className="mt-4">
          <div className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-zinc-200 dark:border-[#23232A]">
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Containers Running On This Image</h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Instances instantiated from this specific image version</p>
            </div>

            {usedByContainers.length === 0 ? (
              <div className="py-16 text-center">
                <IconBox className="w-9 h-9 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
                <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">No Active Containers</h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">This image is currently idle and can be deleted if no longer needed.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-zinc-50 dark:bg-[#15151A] border-b border-zinc-200 dark:border-[#23232A] text-zinc-500 font-medium">
                  <TableRow>
                    <TableHead className="py-2.5 px-4 font-semibold text-zinc-500 dark:text-zinc-400">Container Name</TableHead>
                    <TableHead className="py-2.5 px-3 font-semibold text-zinc-500 dark:text-zinc-400">Container ID</TableHead>
                    <TableHead className="py-2.5 px-3 font-semibold text-zinc-500 dark:text-zinc-400">State</TableHead>
                    <TableHead className="py-2.5 px-4 font-semibold text-right text-zinc-500 dark:text-zinc-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-zinc-100 dark:divide-[#1C1C22]">
                  {usedByContainers.map((c) => (
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

                      <TableCell className="py-3 px-3 font-mono text-zinc-500">
                        {c.id.substring(0, 12)}
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

        <TabsContent value="env" className="mt-4">
        <div className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Environment Variables</h3>
              <p className="text-[11px] text-zinc-500">Variables baked into image layer configuration</p>
            </div>

            <div className="relative w-64">
              <IconSearch className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <Input
                placeholder="Filter variables..."
                value={envSearch}
                onChange={(e) => setEnvSearch(e.target.value)}
                className="pl-9 h-8 text-xs"
              />
            </div>
          </div>

          {filteredEnv.length === 0 ? (
            <p className="text-xs text-zinc-400 italic py-6 text-center">No matching environment variables.</p>
          ) : (
            <div className="space-y-1.5">
              {filteredEnv.map((env, i) => {
                const [k, ...rest] = env.split('=');
                const val = rest.join('=');
                return (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-xs flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-semibold text-purple-600 dark:text-purple-400 shrink-0">{k}</span>
                      <span className="text-zinc-400">=</span>
                      <span className="text-zinc-700 dark:text-zinc-300 truncate select-all">{val}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(val, `env-${i}`)}
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 shrink-0"
                      title="Copy value"
                    >
                      {copiedKey === `env-${i}` ? <IconCheck className="w-3.5 h-3.5 text-emerald-500" /> : <IconCopy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </TabsContent>

        <TabsContent value="layers" className="mt-4">
          <div className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-2xl p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">RootFS Filesystem Layers</h3>
              <p className="text-[11px] text-zinc-500">Immutable content-addressable storage blobs composing the container filesystem</p>
            </div>

            {(!inspectData.RootFS?.Layers || inspectData.RootFS.Layers.length === 0) ? (
              <p className="text-xs text-zinc-400 italic py-6 text-center">No layers available for this image.</p>
            ) : (
              <div className="space-y-2">
                {inspectData.RootFS.Layers.map((layer, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                  >
                    <span className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/40 flex items-center justify-center font-bold text-[11px] shrink-0">
                      {index + 1}
                    </span>
                    <span className="text-zinc-800 dark:text-zinc-200 truncate flex-1 select-all">{layer}</span>
                    <button
                      onClick={() => copyToClipboard(layer, `layer-${index}`)}
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 shrink-0"
                      title="Copy layer hash"
                    >
                      {copiedKey === `layer-${index}` ? <IconCheck className="w-3.5 h-3.5 text-emerald-500" /> : <IconCopy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="inspect" className="mt-4">
          <div className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-2xl p-5 shadow-xs">
            <JsonViewer data={inspectData} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <TagImageModal
        isOpen={isTagOpen}
        onClose={() => setIsTagOpen(false)}
        imageId={decodedId || inspectData.Id}
        imageShortId={shortId}
        currentTags={tags}
        onSuccess={() => refetch()}
      />

      <PushImageModal
        isOpen={isPushOpen}
        onClose={() => setIsPushOpen(false)}
        imageId={decodedId || inspectData.Id}
        availableTags={tags}
        onSuccess={() => refetch()}
      />
    </div>
  );
}

import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useStack,
  useUpdateStack,
  useStartStack,
  useStopStack,
  useRestartStack,
  usePullStack,
  useDeleteStack,
  useStackLogs,
} from '../../hooks/use-stacks';
import { useContainers } from '../../hooks/use-containers';
import {
  IconArrowLeft,
  IconStack2,
  IconPlayerPlay,
  IconPlayerStop,
  IconRotateClockwise,
  IconCloudDownload,
  IconWebhook,
  IconTrash,
  IconDeviceFloppy,
  IconRefresh,
  IconCopy,
  IconDownload,
  IconEye,
  IconEyeOff,
  IconSearch,
  IconExternalLink,
  IconTerminal2,
  IconFileText,
  IconBox,
  IconCode,
  IconKey,
  IconCheck,
  IconLoader2,
  IconCircleFilled,
} from '@tabler/icons-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { ComposeEditor } from '../editor/compose-editor';
import { ContainerTerminalModal } from '../containers/container-terminal-modal';
import { ContainerLogsModal } from '../containers/container-logs-modal';
import { toast } from 'sonner';

type ActiveTab = 'services' | 'compose' | 'env' | 'logs';

export function StackDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: stack, isLoading, error, refetch } = useStack(id);
  const { data: containers = [] } = useContainers();

  const updateMutation = useUpdateStack();
  const startMutation = useStartStack();
  const stopMutation = useStopStack();
  const restartMutation = useRestartStack();
  const pullMutation = usePullStack();
  const deleteMutation = useDeleteStack();

  const [activeTab, setActiveTab] = useState<ActiveTab>('services');
  const [yamlContent, setYamlContent] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Quick modals for linked containers
  const [terminalContainer, setTerminalContainer] = useState<{ id: string; name: string } | null>(null);
  const [logsContainer, setLogsContainer] = useState<{ id: string; name: string } | null>(null);

  // Stack logs tab state
  const { data: logsData, refetch: refetchLogs, isFetching: isFetchingLogs } = useStackLogs(
    id,
    activeTab === 'logs'
  );
  const [logFilter, setLogFilter] = useState('');
  const [autoScrollLogs, setAutoScrollLogs] = useState(true);
  const logsBottomRef = useRef<HTMLDivElement>(null);

  // Env tab state
  const [showSecretEnv, setShowSecretEnv] = useState<Record<string, boolean>>({});
  const [envFilter, setEnvFilter] = useState('');

  // Sync YAML when stack data loads
  useEffect(() => {
    if (stack?.compose_yaml && !yamlContent) {
      setYamlContent(stack.compose_yaml);
    }
  }, [stack?.compose_yaml]);

  const isYamlDirty = useMemo(() => {
    if (!stack?.compose_yaml) return false;
    return yamlContent !== stack.compose_yaml;
  }, [yamlContent, stack?.compose_yaml]);

  // Containers linked to this stack
  const linkedContainers = useMemo(() => {
    if (!stack?.name) return [];
    return containers.filter(
      (c) =>
        c.stack_name === stack.name ||
        c.names?.some((n) => n.includes(stack.name))
    );
  }, [containers, stack?.name]);

  // Auto scroll logs
  useEffect(() => {
    if (activeTab === 'logs' && autoScrollLogs && logsBottomRef.current) {
      logsBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logsData, activeTab, autoScrollLogs]);

  // Quick Action Handlers
  const handleStart = async () => {
    if (!id || !stack) return;
    setIsActionLoading(true);
    try {
      await startMutation.mutateAsync(id);
      toast.success(`Stack "${stack.name}" started successfully`);
    } catch (err: any) {
      toast.error('Failed to start stack', { description: err.message });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleStop = async () => {
    if (!id || !stack) return;
    setIsActionLoading(true);
    try {
      await stopMutation.mutateAsync(id);
      toast.success(`Stack "${stack.name}" stopped`);
    } catch (err: any) {
      toast.error('Failed to stop stack', { description: err.message });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRestart = async () => {
    if (!id || !stack) return;
    setIsActionLoading(true);
    try {
      await restartMutation.mutateAsync(id);
      toast.success(`Stack "${stack.name}" restarted`);
    } catch (err: any) {
      toast.error('Failed to restart stack', { description: err.message });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handlePull = async () => {
    if (!id || !stack) return;
    setIsActionLoading(true);
    try {
      await pullMutation.mutateAsync(id);
      toast.success(`Stack "${stack.name}" images pulled and redeployed`);
    } catch (err: any) {
      toast.error('Failed to pull and update stack', { description: err.message });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !stack) return;
    if (confirm(`Are you sure you want to delete stack "${stack.name}" and remove all containers?`)) {
      setIsActionLoading(true);
      try {
        await deleteMutation.mutateAsync({ id, deleteVolumes: false });
        toast.success(`Stack "${stack.name}" deleted`);
        navigate('/stacks');
      } catch (err: any) {
        toast.error('Failed to delete stack', { description: err.message });
        setIsActionLoading(false);
      }
    }
  };

  const handleSaveCompose = async () => {
    if (!id || !stack) return;
    setIsActionLoading(true);
    try {
      await updateMutation.mutateAsync({
        id,
        compose_yaml: yamlContent,
        redeploy: true,
      });
      toast.success('Compose configuration saved and redeployed!');
      refetch();
    } catch (err: any) {
      toast.error('Failed to update stack', { description: err.message });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    toast.success(`Copied ${label} to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadYaml = () => {
    if (!stack) return;
    const blob = new Blob([yamlContent || stack.compose_yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${stack.name}-compose.yml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <IconLoader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-xs text-zinc-500 font-mono">Loading stack deployment details...</p>
      </div>
    );
  }

  if (error || !stack) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/stacks')} className="gap-2">
          <IconArrowLeft className="w-4 h-4" />
          Back to Stacks
        </Button>
        <div className="border border-dashed border-red-300 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 rounded-2xl p-12 text-center">
          <IconStack2 className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Stack Not Found</h3>
          <p className="text-xs text-zinc-500 mt-1">
            The requested compose stack could not be located or may have been deleted.
          </p>
          <Button size="sm" variant="surface" className="mt-4" onClick={() => navigate('/stacks')}>
            View All Stacks
          </Button>
        </div>
      </div>
    );
  }

  // Filter logs
  const rawLogs = logsData?.logs || 'No compose logs available.';
  const filteredLogs = logFilter
    ? rawLogs
        .split('\n')
        .filter((line) => line.toLowerCase().includes(logFilter.toLowerCase()))
        .join('\n')
    : rawLogs;

  // Filter env vars
  const envEntries = Object.entries(stack.env_vars || {}).filter(([k, v]) => {
    if (!envFilter) return true;
    return k.toLowerCase().includes(envFilter.toLowerCase()) || v.toLowerCase().includes(envFilter.toLowerCase());
  });

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col gap-4">
        {/* Navigation Breadcrumb back */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/stacks')}
            className="gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <IconArrowLeft className="w-4 h-4" />
            Back to Stacks
          </Button>

          {/* Top Quick Actions */}
          <div className="flex items-center gap-2">
            {isActionLoading ? (
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-500 bg-zinc-100 dark:bg-[#1A1A22] rounded-lg">
                <IconLoader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                <span>Applying action...</span>
              </div>
            ) : (
              <>
                {stack.status === 'stopped' ? (
                  <Button
                    variant="surface"
                    size="sm"
                    onClick={handleStart}
                    className="gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
                  >
                    <IconPlayerPlay className="w-3.5 h-3.5" />
                    Start Stack
                  </Button>
                ) : (
                  <Button
                    variant="surface"
                    size="sm"
                    onClick={handleStop}
                    className="gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:text-amber-500"
                  >
                    <IconPlayerStop className="w-3.5 h-3.5" />
                    Stop Stack
                  </Button>
                )}

                <Button
                  variant="surface"
                  size="sm"
                  onClick={handleRestart}
                  className="gap-1.5 text-xs"
                  title="Restart all services in stack"
                >
                  <IconRotateClockwise className="w-3.5 h-3.5 text-zinc-500" />
                  Restart
                </Button>

                <Button
                  variant="surface"
                  size="sm"
                  onClick={handlePull}
                  className="gap-1.5 text-xs"
                  title="Pull latest images and redeploy containers"
                >
                  <IconCloudDownload className="w-3.5 h-3.5 text-blue-500" />
                  Pull & Redeploy
                </Button>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() =>
                    handleCopy(
                      `https://dockor.local/api/v1/webhooks/deploy/whk_${stack.id}`,
                      'CI/CD Webhook URL'
                    )
                  }
                  title="Copy CI/CD Webhook URL"
                >
                  <IconWebhook className="w-4 h-4 text-zinc-500" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleDelete}
                  className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                  title="Delete Stack"
                >
                  <IconTrash className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Hero Card */}
        <div className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
                <IconStack2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{stack.name}</h1>
                  <Badge
                    variant={
                      stack.status === 'running'
                        ? 'success'
                        : stack.status === 'deploying'
                        ? 'warning'
                        : stack.status === 'error'
                        ? 'destructive'
                        : 'neutral'
                    }
                    dot
                    className="text-xs capitalize"
                  >
                    {stack.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">ID: {stack.id}</span>
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <span>Node: <strong className="font-mono font-medium text-zinc-700 dark:text-zinc-300">{stack.node_id}</strong></span>
                  {stack.template_id && (
                    <>
                      <span className="text-zinc-300 dark:text-zinc-700">•</span>
                      <span>
                        Catalog Template: <strong className="text-blue-600 dark:text-blue-400 font-medium">{stack.template_id}</strong>
                      </span>
                    </>
                  )}
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <span>Created: {new Date(stack.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Quick Stat Counter */}
            <div className="flex items-center gap-3 bg-zinc-50 dark:bg-[#0A0A0E] border border-zinc-200 dark:border-[#1E1E24] px-4 py-2.5 rounded-xl self-start md:self-auto">
              <div className="text-center">
                <div className="text-[10px] uppercase font-semibold text-zinc-400">Services</div>
                <div className="text-base font-bold font-mono text-zinc-800 dark:text-zinc-200">
                  {linkedContainers.length}
                </div>
              </div>
              <div className="w-px h-7 bg-zinc-200 dark:bg-[#202026]" />
              <div className="text-center">
                <div className="text-[10px] uppercase font-semibold text-zinc-400">Running</div>
                <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {linkedContainers.filter((c) => c.state === 'running').length}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-[#23232A]">
        <button
          onClick={() => setActiveTab('services')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
            activeTab === 'services'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <IconBox className="w-4 h-4" />
          <span>Services & Containers</span>
          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-[#1E1E24] text-zinc-600 dark:text-zinc-300 font-mono">
            {linkedContainers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('compose')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
            activeTab === 'compose'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <IconCode className="w-4 h-4" />
          <span>Compose Definition</span>
          {isYamlDirty && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Unsaved modifications" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('env')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
            activeTab === 'env'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <IconKey className="w-4 h-4" />
          <span>Environment</span>
          {stack.env_vars && Object.keys(stack.env_vars).length > 0 && (
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-[#1E1E24] text-zinc-600 dark:text-zinc-300 font-mono">
              {Object.keys(stack.env_vars).length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
            activeTab === 'logs'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <IconFileText className="w-4 h-4" />
          <span>Aggregated Logs</span>
        </button>
      </div>

      {/* Tab 1: Services & Containers */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          {linkedContainers.length === 0 ? (
            <Card className="p-12 text-center bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A]">
              <IconBox className="w-10 h-10 text-zinc-400 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">No Containers Detected</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
                No active containers are linked to project &quot;{stack.name}&quot;. Start or redeploy the stack to spawn services.
              </p>
              <Button size="sm" variant="surface" onClick={handlePull} className="mt-4 gap-1.5">
                <IconCloudDownload className="w-3.5 h-3.5 text-blue-500" />
                Redeploy Services
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {linkedContainers.map((container) => {
                const cName = container.names?.[0]?.replace(/^\//, '') || container.id.substring(0, 12);
                const isRunning = container.state === 'running';

                return (
                  <Card
                    key={container.id}
                    className="p-4 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] hover:border-zinc-300 dark:hover:border-zinc-700/80 transition-all shadow-sm"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left: Container info */}
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          <IconCircleFilled
                            className={`w-3 h-3 ${
                              isRunning ? 'text-emerald-500 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-600'
                            }`}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              onClick={() => navigate(`/containers/${container.id}`)}
                              className="font-bold text-sm text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer font-mono"
                            >
                              {cName}
                            </span>
                            <Badge
                              variant={isRunning ? 'success' : 'neutral'}
                              className="text-[10px]"
                            >
                              {container.state}
                            </Badge>
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-1">
                            {container.image}
                          </div>

                          {/* Ports */}
                          {container.ports && container.ports.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              {container.ports.map((p, idx) => {
                                const hasPublic = Boolean(p.public_port);
                                return (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-100 dark:bg-[#1A1A22] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-[#272730]"
                                  >
                                    {hasPublic ? (
                                      <a
                                        href={`http://localhost:${p.public_port}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
                                      >
                                        :{p.public_port}
                                        <IconExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    ) : (
                                      `${p.private_port}/${p.type}`
                                    )}
                                    {hasPublic && <span className="text-zinc-400">&rarr; {p.private_port}</span>}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 self-end md:self-auto">
                        <Button
                          variant="surface"
                          size="sm"
                          onClick={() => setLogsContainer({ id: container.id, name: cName })}
                          className="gap-1.5 text-xs"
                          title="Quick Live Logs"
                        >
                          <IconFileText className="w-3.5 h-3.5 text-zinc-500" />
                          Logs
                        </Button>

                        <Button
                          variant="surface"
                          size="sm"
                          onClick={() => setTerminalContainer({ id: container.id, name: cName })}
                          className="gap-1.5 text-xs"
                          title="Interactive Web Console"
                          disabled={!isRunning}
                        >
                          <IconTerminal2 className="w-3.5 h-3.5 text-zinc-500" />
                          Terminal
                        </Button>

                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => navigate(`/containers/${container.id}`)}
                          className="gap-1.5 text-xs"
                        >
                          <span>Manage</span>
                          <IconArrowLeft className="w-3 h-3 rotate-180" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Compose YAML Editor */}
      {activeTab === 'compose' && (
        <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] overflow-hidden shadow-sm">
          {/* Editor Header Bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-[#0E0E12] border-b border-zinc-200 dark:border-[#202026]">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                docker-compose.yml
              </span>
              {isYamlDirty ? (
                <Badge variant="warning" className="text-[10px]">
                  Unsaved Changes
                </Badge>
              ) : (
                <Badge variant="neutral" className="text-[10px]">
                  Synchronized
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isYamlDirty && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setYamlContent(stack.compose_yaml)}
                  className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Discard Changes
                </Button>
              )}

              <Button
                variant="surface"
                size="sm"
                onClick={handleDownloadYaml}
                className="gap-1 text-xs"
                title="Download docker-compose.yml"
              >
                <IconDownload className="w-3.5 h-3.5" />
                Download
              </Button>

              <Button
                variant="surface"
                size="sm"
                onClick={() => handleCopy(yamlContent, 'Compose YAML')}
                className="gap-1 text-xs"
              >
                {copiedKey === 'Compose YAML' ? (
                  <IconCheck className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <IconCopy className="w-3.5 h-3.5" />
                )}
                Copy
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveCompose}
                disabled={isActionLoading || !isYamlDirty}
                className="gap-1.5 text-xs"
              >
                {isActionLoading ? (
                  <IconLoader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <IconDeviceFloppy className="w-3.5 h-3.5" />
                )}
                Save & Redeploy
              </Button>
            </div>
          </div>

          {/* Monaco Editor Container */}
          <div className="h-[600px] w-full bg-white dark:bg-[#0A0A0D]">
            <ComposeEditor
              value={yamlContent}
              onChange={(val) => setYamlContent(val || '')}
              height="100%"
            />
          </div>
        </Card>
      )}

      {/* Tab 3: Environment Variables */}
      {activeTab === 'env' && (
        <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] p-4 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Active Stack Environment Variables
              </h3>
              <p className="text-xs text-zinc-500">
                Variables passed during deployment or synthesized from catalog presets.
              </p>
            </div>

            <div className="w-full sm:w-64">
              <div className="relative">
                <IconSearch className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Filter environment keys..."
                  value={envFilter}
                  onChange={(e) => setEnvFilter(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-[#272730] bg-zinc-50 dark:bg-[#0A0A0E] text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {envEntries.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500 border border-dashed border-zinc-200 dark:border-[#202026] rounded-xl">
              No specific environment variables registered for this stack.
            </div>
          ) : (
            <div className="border border-zinc-200 dark:border-[#23232A] rounded-xl overflow-hidden divide-y divide-zinc-200 dark:divide-[#23232A]">
              {envEntries.map(([key, value]) => {
                const isSecret = /secret|password|key|token|auth/i.test(key);
                const isVisible = showSecretEnv[key] || !isSecret;

                return (
                  <div
                    key={key}
                    className="flex items-center justify-between p-3 bg-zinc-50/50 dark:bg-[#0A0A0E]/50 hover:bg-zinc-50 dark:hover:bg-[#14141A] transition-colors"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                        {key}
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-700">=</span>
                      <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 truncate">
                        {isVisible ? value : '••••••••••••••••'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      {isSecret && (
                        <button
                          onClick={() =>
                            setShowSecretEnv((prev) => ({
                              ...prev,
                              [key]: !prev[key],
                            }))
                          }
                          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded"
                          title={isVisible ? 'Mask secret' : 'Reveal secret'}
                        >
                          {isVisible ? <IconEyeOff className="w-3.5 h-3.5" /> : <IconEye className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <button
                        onClick={() => handleCopy(value, key)}
                        className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded"
                        title="Copy Value"
                      >
                        {copiedKey === key ? (
                          <IconCheck className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <IconCopy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Tab 4: Aggregated Logs */}
      {activeTab === 'logs' && (
        <Card className="bg-[#09090C] border-[#222228] p-4 text-zinc-100 shadow-sm space-y-3 font-mono">
          {/* Log Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-[#1E1E24] pb-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-zinc-400">Filter:</span>
              <div className="relative flex-1 sm:w-64">
                <IconSearch className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Grep compose logs..."
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border border-[#272730] bg-[#121216] text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={() => setAutoScrollLogs(!autoScrollLogs)}
                className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                  autoScrollLogs
                    ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                    : 'border-[#272730] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Auto-scroll: {autoScrollLogs ? 'ON' : 'OFF'}
              </button>

              <button
                onClick={() => refetchLogs()}
                disabled={isFetchingLogs}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded border border-[#272730] hover:bg-[#1A1A22]"
                title="Refresh Logs"
              >
                <IconRefresh className={`w-3.5 h-3.5 ${isFetchingLogs ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={() => handleCopy(filteredLogs, 'Stack Logs')}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded border border-[#272730] hover:bg-[#1A1A22]"
                title="Copy All Filtered Logs"
              >
                {copiedKey === 'Stack Logs' ? (
                  <IconCheck className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <IconCopy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Terminal log window */}
          <div className="h-[520px] overflow-y-auto rounded-lg p-3 text-xs leading-relaxed select-text bg-[#050507] border border-[#1A1A20]">
            <pre className="whitespace-pre-wrap font-mono text-[11px] text-zinc-300">
              {filteredLogs}
            </pre>
            <div ref={logsBottomRef} />
          </div>
        </Card>
      )}

      {/* Quick Modals */}
      {terminalContainer && (
        <ContainerTerminalModal
          containerId={terminalContainer.id}
          containerName={terminalContainer.name}
          isOpen={true}
          onClose={() => setTerminalContainer(null)}
        />
      )}

      {logsContainer && (
        <ContainerLogsModal
          containerId={logsContainer.id}
          containerName={logsContainer.name}
          isOpen={true}
          onClose={() => setLogsContainer(null)}
        />
      )}
    </div>
  );
}

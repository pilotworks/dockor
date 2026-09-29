import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useStacks,
  useDeleteStack,
  useStartStack,
  useStopStack,
  useRestartStack,
  usePullStack,
  useUpdateStack,
} from '../../hooks/use-stacks';
import { useContainers } from '../../hooks/use-containers';
import { api } from '../../lib/api';
import {
  IconStack2,
  IconTrash,
  IconCircleFilled,
  IconCode,
  IconPlus,
  IconWebhook,
  IconPlayerPlay,
  IconPlayerStop,
  IconRotateClockwise,
  IconCloudDownload,
  IconFileText,
  IconLoader2,
  IconDeviceFloppy,
  IconCopy,
} from '@tabler/icons-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { ComposeEditor } from '../editor/compose-editor';
import { CreateStackModal } from '../stacks/create-stack-modal';

export function StacksView() {
  const { data: stacks = [], isLoading } = useStacks();
  const { data: containers = [] } = useContainers();
  const deleteMutation = useDeleteStack();
  const startMutation = useStartStack();
  const stopMutation = useStopStack();
  const restartMutation = useRestartStack();
  const pullMutation = usePullStack();
  const updateMutation = useUpdateStack();
  const navigate = useNavigate();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editStackModal, setEditStackModal] = useState<{
    id: string;
    name: string;
    yaml: string;
    originalYaml: string;
    isSaving: boolean;
  } | null>(null);
  const [logsModal, setLogsModal] = useState<{ id: string; name: string; logs: string; loading: boolean } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const handleStart = async (id: string, name: string) => {
    setActionLoadingId(id);
    try {
      await startMutation.mutateAsync(id);
      toast.success(`Stack "${name}" started`);
    } catch (err: any) {
      toast.error('Failed to start stack', { description: err.message });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStop = async (id: string, name: string) => {
    setActionLoadingId(id);
    try {
      await stopMutation.mutateAsync(id);
      toast.success(`Stack "${name}" stopped`);
    } catch (err: any) {
      toast.error('Failed to stop stack', { description: err.message });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRestart = async (id: string, name: string) => {
    setActionLoadingId(id);
    try {
      await restartMutation.mutateAsync(id);
      toast.success(`Stack "${name}" restarted`);
    } catch (err: any) {
      toast.error('Failed to restart stack', { description: err.message });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePull = async (id: string, name: string) => {
    setActionLoadingId(id);
    try {
      await pullMutation.mutateAsync(id);
      toast.success(`Stack "${name}" pulled and updated`);
    } catch (err: any) {
      toast.error('Failed to pull stack updates', { description: err.message });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleViewLogs = async (id: string, name: string) => {
    setLogsModal({ id, name, logs: 'Loading compose logs...', loading: true });
    try {
      const res = await api.getStackLogs(id);
      setLogsModal({ id, name, logs: res.logs || 'No logs available for this stack.', loading: false });
    } catch (err: any) {
      setLogsModal({ id, name, logs: `Failed to fetch logs: ${err.message}`, loading: false });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete stack "${name}" and stop all its containers?`)) {
      try {
        await deleteMutation.mutateAsync({ id, deleteVolumes: false });
        toast.success(`Stack "${name}" deleted`);
      } catch (err: any) {
        toast.error('Failed to delete stack', { description: err.message });
      }
    }
  };

  const handleSaveStack = async () => {
    if (!editStackModal) return;
    setEditStackModal((prev) => (prev ? { ...prev, isSaving: true } : null));
    try {
      await updateMutation.mutateAsync({
        id: editStackModal.id,
        compose_yaml: editStackModal.yaml,
        redeploy: true,
      });
      toast.success(`Stack "${editStackModal.name}" updated and redeployed!`);
      setEditStackModal(null);
    } catch (err: any) {
      toast.error('Failed to update stack', { description: err.message });
      setEditStackModal((prev) => (prev ? { ...prev, isSaving: false } : null));
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex items-center justify-between bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-[#23232A] rounded-xl p-4 transition-colors">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Active Compose Deployments</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Multi-container application stacks orchestrated via Docker Compose v2.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="surface"
            onClick={() => setIsCreateModalOpen(true)}
            className="gap-1.5"
          >
            <IconCode className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
            Custom Compose
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => navigate('/templates')}
            className="gap-1.5"
          >
            <IconPlus className="w-3.5 h-3.5" />
            From Catalog
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="py-20 text-center text-xs text-zinc-500">
          Loading compose stacks...
        </div>
      )}

      {!isLoading && stacks.length === 0 && (
        <div className="border border-dashed border-zinc-300 dark:border-[#272730] rounded-2xl p-16 text-center bg-white dark:bg-[#0D0D10]/50 transition-colors">
          <IconStack2 className="w-10 h-10 text-zinc-400 dark:text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-300">No stacks deployed yet</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            Write a custom Docker Compose definition or deploy verified applications from the App Catalog.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button
              size="sm"
              variant="surface"
              onClick={() => setIsCreateModalOpen(true)}
              className="gap-1.5"
            >
              <IconCode className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
              Write Custom Compose
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => navigate('/templates')}
              className="gap-1.5"
            >
              <IconPlus className="w-3.5 h-3.5" />
              Browse App Catalog
            </Button>
          </div>
        </div>
      )}

      {/* Stacks List */}
      {!isLoading && stacks.length > 0 && (
        <div className="space-y-3">
          {stacks.map((stack) => {
            // Find containers associated with this stack
            const stackContainers = containers.filter(
              (c) => c.stack_name === stack.name || c.names?.some((n) => n.includes(stack.name))
            );

            return (
              <Card
                key={stack.id}
                className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] hover:border-zinc-300 dark:hover:border-zinc-700/80 transition-all p-5 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-[#09090B] border border-blue-200 dark:border-[#272730] flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold shadow-inner">
                      <IconStack2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{stack.name}</h4>
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
                          className="text-[10px]"
                        >
                          {stack.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">Node: {stack.node_id}</span>
                        {stack.template_id && (
                          <>
                            <span className="text-zinc-300 dark:text-zinc-600">•</span>
                            <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
                              Template: <span className="text-blue-600 dark:text-blue-400 font-medium">{stack.template_id}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Top-Right Quick Actions */}
                  <div className="flex items-center gap-1.5">
                    {actionLoadingId === stack.id ? (
                      <div className="flex items-center gap-1 px-2.5 py-1 text-xs text-zinc-400">
                        <IconLoader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <>
                        {stack.status === 'stopped' ? (
                          <Button
                            variant="surface"
                            size="sm"
                            onClick={() => handleStart(stack.id, stack.name)}
                            className="gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
                            title="Start Stack"
                          >
                            <IconPlayerPlay className="w-3.5 h-3.5" />
                            Start
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="surface"
                              size="sm"
                              onClick={() => handleStop(stack.id, stack.name)}
                              className="gap-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-amber-500"
                              title="Stop Stack"
                            >
                              <IconPlayerStop className="w-3.5 h-3.5" />
                              Stop
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleRestart(stack.id, stack.name)}
                              title="Restart Stack"
                            >
                              <IconRotateClockwise className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handlePull(stack.id, stack.name)}
                              title="Pull Latest Images and Redeploy"
                            >
                              <IconCloudDownload className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                            </Button>
                          </>
                        )}

                        <Button
                          variant="surface"
                          size="sm"
                          onClick={() => handleViewLogs(stack.id, stack.name)}
                          className="gap-1.5 text-xs"
                          title="View Compose Logs"
                        >
                          <IconFileText className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                          Logs
                        </Button>

                        <Button
                          variant="surface"
                          size="sm"
                          onClick={() =>
                            setEditStackModal({
                              id: stack.id,
                              name: stack.name,
                              yaml: stack.compose_yaml,
                              originalYaml: stack.compose_yaml,
                              isSaving: false,
                            })
                          }
                          className="gap-1.5 text-xs"
                          title="Inspect or edit compose yaml"
                        >
                          <IconCode className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                          Compose
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `https://dockor.local/api/v1/webhooks/deploy/whk_${stack.id}`
                            );
                            toast.success('CI/CD Deploy Webhook URL copied');
                          }}
                          title="Copy CI/CD Webhook"
                        >
                          <IconWebhook className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(stack.id, stack.name)}
                          className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                          title="Delete Stack"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Sub-containers preview */}
                {stackContainers.length > 0 && (
                  <div className="mt-4 pt-3.5 border-t border-zinc-100 dark:border-[#1C1C22]">
                    <div className="text-[10px] uppercase font-semibold text-zinc-400 dark:text-zinc-500 tracking-wider mb-2">
                      Linked Services ({stackContainers.length})
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {stackContainers.map((sc) => {
                        const scName = sc.names?.[0]?.replace(/^\//, '') || sc.id.substring(0, 10);
                        const isRunning = sc.state === 'running';

                        return (
                          <div
                            key={sc.id}
                            className="bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-[#202026] rounded-lg p-2 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <IconCircleFilled
                                className={`w-2 h-2 shrink-0 ${
                                  isRunning ? 'text-emerald-500 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-600'
                                }`}
                              />
                              <span className="font-mono text-[11px] text-zinc-800 dark:text-zinc-300 truncate">
                                {scName}
                              </span>
                            </div>
                            <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0">
                              {sc.image.split(':')[0]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Monaco Compose Editor & Redeploy Dialog */}
      {editStackModal && (
        <Dialog open={Boolean(editStackModal)} onOpenChange={() => setEditStackModal(null)}>
          <DialogContent className="max-w-4xl h-[82vh] p-0 flex flex-col bg-white dark:bg-[#0F0F13] border-zinc-200 dark:border-[#272730] shadow-2xl rounded-2xl overflow-hidden transition-colors">
            <DialogHeader className="px-5 py-3 border-b border-zinc-200 dark:border-[#1F1F24] bg-zinc-50 dark:bg-[#0A0A0D] flex flex-row items-center justify-between shrink-0 transition-colors">
              <div className="flex items-center gap-2">
                <IconCode className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                <DialogTitle className="text-sm font-mono text-zinc-900 dark:text-zinc-200">
                  {editStackModal.name} / docker-compose.yml
                </DialogTitle>
                {editStackModal.yaml !== editStackModal.originalYaml && (
                  <Badge variant="warning" className="text-[9px] font-mono px-1.5 py-0">
                    modified
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 mr-6">
                {editStackModal.yaml !== editStackModal.originalYaml && (
                  <Button
                    variant="surface"
                    size="sm"
                    onClick={() =>
                      setEditStackModal((prev) =>
                        prev ? { ...prev, yaml: prev.originalYaml } : null
                      )
                    }
                    className="h-7 px-2.5 text-xs gap-1"
                    title="Revert to original saved YAML"
                  >
                    <IconRotateClockwise className="w-3.5 h-3.5" />
                    Revert
                  </Button>
                )}

                <Button
                  variant="surface"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(editStackModal.yaml);
                    toast.success('Compose YAML copied to clipboard');
                  }}
                  className="h-7 px-2.5 text-xs gap-1"
                  title="Copy YAML"
                >
                  <IconCopy className="w-3.5 h-3.5" />
                  Copy
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  disabled={editStackModal.isSaving}
                  onClick={handleSaveStack}
                  className="h-7 px-3 text-xs gap-1.5 shadow-sm"
                  title="Save Compose and Redeploy Stack"
                >
                  {editStackModal.isSaving ? (
                    <IconLoader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <IconDeviceFloppy className="w-3.5 h-3.5" />
                  )}
                  {editStackModal.isSaving ? 'Redeploying...' : 'Save & Redeploy'}
                </Button>
              </div>
            </DialogHeader>

            <div className="flex-1 w-full h-full min-h-0 bg-white dark:bg-[#09090b]">
              <ComposeEditor
                value={editStackModal.yaml}
                onChange={(val) =>
                  setEditStackModal((prev) => (prev ? { ...prev, yaml: val || '' } : null))
                }
                readOnly={false}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Stack Logs Dialog */}
      {logsModal && (
        <Dialog open={Boolean(logsModal)} onOpenChange={() => setLogsModal(null)}>
          <DialogContent className="max-w-4xl bg-white dark:bg-[#0F0F13] border-zinc-200 dark:border-[#272730] p-0 overflow-hidden rounded-2xl transition-colors">
            <DialogHeader className="p-4 border-b border-zinc-200 dark:border-[#1F1F24] bg-zinc-50 dark:bg-[#0A0A0D] flex flex-row items-center justify-between transition-colors">
              <DialogTitle className="text-sm font-mono text-zinc-900 dark:text-zinc-200">
                Logs: {logsModal.name}
              </DialogTitle>
              <Button
                variant="surface"
                size="sm"
                onClick={() => handleViewLogs(logsModal.id, logsModal.name)}
                disabled={logsModal.loading}
                className="gap-1.5 text-xs mr-6"
              >
                <IconRotateClockwise className={`w-3.5 h-3.5 ${logsModal.loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </DialogHeader>
            <div className="p-4 max-h-[70vh] min-h-[300px] overflow-auto bg-zinc-50 dark:bg-[#09090B] font-mono text-xs text-zinc-800 dark:text-zinc-300 leading-relaxed transition-colors">
              <pre className="whitespace-pre-wrap">{logsModal.logs}</pre>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Custom Stack Modal */}
      <CreateStackModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}

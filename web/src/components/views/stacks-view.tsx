import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStacks, useDeleteStack } from '../../hooks/use-stacks';
import { useContainers } from '../../hooks/use-containers';
import {
  IconStack2,
  IconTrash,
  IconCircleFilled,
  IconCode,
  IconPlus,
  IconWebhook,
} from '@tabler/icons-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';

export function StacksView() {
  const { data: stacks = [], isLoading } = useStacks();
  const { data: containers = [] } = useContainers();
  const deleteMutation = useDeleteStack();
  const navigate = useNavigate();

  const [inspectStack, setInspectStack] = useState<{ name: string; yaml: string } | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete stack "${name}"?`)) {
      try {
        await deleteMutation.mutateAsync(id);
        toast.success(`Stack "${name}" deleted`);
      } catch (err: any) {
        toast.error('Failed to delete stack', { description: err.message });
      }
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

        <Button
          size="sm"
          variant="primary"
          onClick={() => navigate('/templates')}
          className="gap-1.5"
        >
          <IconPlus className="w-3.5 h-3.5" />
          Deploy New Stack
        </Button>
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
            Choose an application from the Template Catalog or write a custom Docker Compose definition.
          </p>
          <Button
            size="sm"
            variant="surface"
            onClick={() => navigate('/templates')}
            className="mt-4 gap-1.5"
          >
            <IconPlus className="w-3.5 h-3.5" />
            Browse Template Catalog
          </Button>
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
                        <Badge variant="success" dot className="text-[10px]">
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
                    <Button
                      variant="surface"
                      size="sm"
                      onClick={() =>
                        setInspectStack({ name: stack.name, yaml: stack.compose_yaml })
                      }
                      className="gap-1.5 text-xs"
                      title="Inspect compose yaml"
                    >
                      <IconCode className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                      View Compose
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

      {/* Inspect Compose Dialog */}
      {inspectStack && (
        <Dialog open={Boolean(inspectStack)} onOpenChange={() => setInspectStack(null)}>
          <DialogContent className="max-w-3xl bg-white dark:bg-[#0F0F13] border-zinc-200 dark:border-[#272730] p-0 overflow-hidden rounded-2xl">
            <DialogHeader className="p-4 border-b border-zinc-200 dark:border-[#1F1F24] bg-zinc-50 dark:bg-[#0A0A0D]">
              <DialogTitle className="text-sm font-mono text-zinc-900 dark:text-zinc-200">
                {inspectStack.name} / docker-compose.yml
              </DialogTitle>
            </DialogHeader>
            <div className="p-4 max-h-[70vh] overflow-auto bg-zinc-50 dark:bg-[#09090B] font-mono text-xs text-zinc-800 dark:text-zinc-300">
              <pre className="whitespace-pre">{inspectStack.yaml}</pre>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

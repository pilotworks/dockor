import { useState } from 'react';
import { useNodes } from '../../hooks/use-nodes';
import {
  IconServer,
  IconClock,
  IconCpu,
  IconNetwork,
  IconPlus,
  IconTrash,
  IconRefresh,
  IconActivity,
  IconBox,
  IconDeviceDesktopAnalytics,
} from '@tabler/icons-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { confirmDialog } from '../../stores/use-dialog-store';
import { api } from '../../lib/api';
import { EnrollNodeModal } from '../nodes/enroll-node-modal';

export function NodesView() {
  const { data: nodes = [], isLoading, refetch, isFetching } = useNodes();
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [latencies, setLatencies] = useState<Record<string, number>>({});

  const handleDeleteNode = async (id: string, name: string) => {
    const confirmed = await confirmDialog({
      title: `Remove Node "${name}"`,
      description: 'Are you sure you want to remove this remote node from your cluster topology? Containers running on this node will not be stopped.',
      confirmText: 'Remove Node',
      variant: 'destructive',
    });
    if (!confirmed) return;

    try {
      await api.deleteNode(id);
      toast.success(`Node ${name} removed`);
      refetch();
    } catch (err: any) {
      toast.error('Failed to remove node: ' + err.message);
    }
  };

  const handlePingNode = async (id: string, name: string) => {
    setPingingId(id);
    try {
      const res = await api.pingNode(id);
      setLatencies((prev) => ({ ...prev, [id]: res.latency_ms }));
      toast.success(`Ping to ${name} successful: ${res.latency_ms} ms`);
    } catch (err: any) {
      toast.error(`Ping failed for ${name}: ` + err.message);
    } finally {
      setPingingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex items-center justify-between bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-[#23232A] rounded-xl p-4 transition-colors">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Cluster Node Topology</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Docker engines managed locally via socket or remotely via lightweight outbound agents.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="surface"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 gap-1.5 text-xs"
            title="Refresh Nodes"
          >
            <IconRefresh className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsEnrollOpen(true)}
            className="h-8 gap-1.5 text-xs"
          >
            <IconPlus className="w-3.5 h-3.5" />
            <span>Enroll Remote Node</span>
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="py-20 text-center text-xs text-zinc-500">
          Querying cluster topology...
        </div>
      )}

      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {nodes.map((node) => {
            const isOnline = node.status === 'online';
            const memGB = node.total_memory ? (node.total_memory / (1024 * 1024 * 1024)).toFixed(1) : null;
            const latency = latencies[node.id];
            const isPinging = pingingId === node.id;

            return (
              <Card
                key={node.id}
                className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] hover:border-zinc-300 dark:hover:border-zinc-700 transition-all p-5 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-[#09090B] border border-blue-200 dark:border-[#272730] flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
                      <IconServer className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">{node.name}</h4>
                        <Badge
                          variant={isOnline ? 'success' : 'destructive'}
                          dot
                          className="text-[10px]"
                        >
                          {node.status}
                        </Badge>
                        {latency !== undefined && (
                          <Badge variant="outline" className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                            {latency} ms
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                        {node.hostname || 'localhost'} • {node.ip_address}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => handlePingNode(node.id, node.name)}
                      disabled={isPinging || !isOnline}
                      className="text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                      title="Test Connection Latency"
                    >
                      <IconActivity className={`w-3.5 h-3.5 ${isPinging ? 'animate-pulse text-blue-500' : ''}`} />
                    </Button>

                    {!node.is_local && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => handleDeleteNode(node.id, node.name)}
                        className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                        title="Remove Node"
                      >
                        <IconTrash className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 pt-3.5 border-t border-zinc-100 dark:border-[#1C1C22] text-xs">
                  <div className="bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-[#202026] rounded-lg p-2.5">
                    <span className="text-[10px] uppercase font-semibold text-zinc-400 dark:text-zinc-500 block mb-0.5">
                      Hardware Specs
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-zinc-800 dark:text-zinc-300 text-[11px]">
                      <IconCpu className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                      <span>{node.cpu_cores} Cores {memGB ? `• ${memGB} GB` : ''}</span>
                    </div>
                  </div>

                  <div className="bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-[#202026] rounded-lg p-2.5">
                    <span className="text-[10px] uppercase font-semibold text-zinc-400 dark:text-zinc-500 block mb-0.5">
                      Connection Mode
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-zinc-800 dark:text-zinc-300 text-[11px]">
                      <IconNetwork className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                      <span className="truncate" title={node.endpoint || (node.is_local ? 'Local Socket' : 'Reverse Tunnel')}>
                        {node.is_local ? 'Local Socket' : 'Reverse Tunnel'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Telemetry info for remote agents or running containers */}
                {(node.containers_total !== undefined && node.containers_total > 0 || node.agent_version || node.os) && (
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <div className="bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-[#202026] rounded-lg p-2.5">
                      <span className="text-[10px] uppercase font-semibold text-zinc-400 dark:text-zinc-500 block mb-0.5">
                        Containers
                      </span>
                      <div className="flex items-center gap-1.5 font-mono text-zinc-800 dark:text-zinc-300 text-[11px]">
                        <IconBox className="w-3.5 h-3.5 text-blue-500" />
                        <span>
                          <strong className="text-emerald-600 dark:text-emerald-400">{node.containers_running || 0}</strong> / {node.containers_total || 0} active
                        </span>
                      </div>
                    </div>

                    <div className="bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-[#202026] rounded-lg p-2.5">
                      <span className="text-[10px] uppercase font-semibold text-zinc-400 dark:text-zinc-500 block mb-0.5">
                        Platform & Agent
                      </span>
                      <div className="flex items-center gap-1.5 font-mono text-zinc-800 dark:text-zinc-300 text-[11px] truncate">
                        <IconDeviceDesktopAnalytics className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                        <span className="truncate">
                          {node.os ? `${node.os}/${node.arch}` : 'Docker Host'} {node.agent_version ? `• v${node.agent_version}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 pt-2 border-t border-zinc-100 dark:border-[#1C1C22]">
                  <span className="flex items-center gap-1.5 font-mono">
                    <IconClock className="w-3 h-3 text-zinc-400" />
                    Docker v{node.docker_version}
                  </span>
                  <span className="text-zinc-400 dark:text-zinc-500 font-mono text-[10px] truncate max-w-[140px]" title={node.endpoint || node.id}>
                    {node.endpoint ? node.endpoint.replace('unix://', '') : `ID: ${node.id}`}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Enroll Node Modal */}
      <EnrollNodeModal
        isOpen={isEnrollOpen}
        onClose={() => setIsEnrollOpen(false)}
        onSuccess={() => refetch()}
      />
    </div>
  );
}

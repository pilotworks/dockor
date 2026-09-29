import { useNodes } from '../../hooks/use-nodes';
import { IconServer, IconClock, IconCpu, IconNetwork, IconPlus } from '@tabler/icons-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { toast } from 'sonner';

export function NodesView() {
  const { data: nodes = [], isLoading } = useNodes();

  const handleEnrollNode = () => {
    toast.info('Generating node enrollment command...', {
      description: 'Run: curl -fsSL https://dockor.local/install-agent.sh | sh',
    });
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

        <Button size="sm" variant="primary" onClick={handleEnrollNode} className="gap-1.5">
          <IconPlus className="w-3.5 h-3.5" />
          Enroll Remote Node
        </Button>
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
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                        {node.hostname} • {node.ip_address}
                      </p>
                    </div>
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
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNetworks, useDeleteNetwork } from '../../hooks/use-networks';
import {
  IconNetwork,
  IconPlus,
  IconSearch,
  IconCopy,
  IconCheck,
  IconTrash,
  IconShieldLock,
  IconArrowsJoin,
  IconArrowRight,
  IconBox,
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
import { CreateNetworkModal } from '../networks/create-network-modal';
import { toast } from 'sonner';
import { confirmDialog } from '../../stores/use-dialog-store';

const SYSTEM_NETWORKS = new Set(['bridge', 'host', 'none']);

export function NetworksView() {
  const navigate = useNavigate();
  const { data: networks = [], isLoading } = useNetworks();
  const deleteMutation = useDeleteNetwork();

  const [search, setSearch] = useState('');
  const [driverFilter, setDriverFilter] = useState<'all' | 'bridge' | 'overlay' | 'host_null' | 'custom'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied network ID to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (netId: string, netName: string) => {
    if (SYSTEM_NETWORKS.has(netName.toLowerCase())) {
      toast.error(`System network "${netName}" cannot be removed`);
      return;
    }

    const confirmed = await confirmDialog({
      title: 'Delete Network',
      description: `Are you sure you want to delete network "${netName}"? All connected containers may lose network connectivity.`,
      confirmText: 'Delete Network',
      variant: 'destructive',
    });

    if (confirmed) {
      try {
        await deleteMutation.mutateAsync(netId);
        toast.success(`Network "${netName}" deleted`);
      } catch (err: any) {
        toast.error('Failed to delete network', { description: err.message });
      }
    }
  };

  // KPIs
  const totalBridge = useMemo(() => networks.filter((n) => n.Driver === 'bridge').length, [networks]);
  const totalOverlay = useMemo(() => networks.filter((n) => n.Driver === 'overlay').length, [networks]);
  const totalContainersAttached = useMemo(() => {
    return networks.reduce((acc, n) => acc + (n.Containers ? Object.keys(n.Containers).length : 0), 0);
  }, [networks]);

  // Filtering
  const filtered = useMemo(() => {
    return networks.filter((net) => {
      // Driver filter
      if (driverFilter === 'bridge' && net.Driver !== 'bridge') return false;
      if (driverFilter === 'overlay' && net.Driver !== 'overlay') return false;
      if (driverFilter === 'host_null' && net.Driver !== 'host' && net.Driver !== 'null') return false;
      if (driverFilter === 'custom' && SYSTEM_NETWORKS.has(net.Name.toLowerCase())) return false;

      // Text query
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const matchName = net.Name.toLowerCase().includes(q);
      const matchId = net.Id.toLowerCase().includes(q);
      const matchDriver = net.Driver.toLowerCase().includes(q);
      const matchSubnet = net.IPAM?.Config?.some((c) => c.Subnet?.toLowerCase().includes(q));

      return matchName || matchId || matchDriver || matchSubnet;
    });
  }, [networks, driverFilter, search]);

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-[#23232A] rounded-xl p-4 transition-colors">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <IconNetwork className="w-4 h-4 text-blue-500" />
            <span>Virtual Networks</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Software-defined networking namespaces, multi-host overlays, and container IPAM routing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsCreateModalOpen(true)}
            className="gap-1.5"
          >
            <IconPlus className="w-3.5 h-3.5" />
            Create Network
          </Button>
        </div>
      </div>

      {/* KPI Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
            Total Networks
          </span>
          <div className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {networks.length}
          </div>
        </Card>

        <Card className="p-3.5 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
            Bridge Drivers
          </span>
          <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">
            {totalBridge}
          </div>
        </Card>

        <Card className="p-3.5 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
            Overlay / Swarm
          </span>
          <div className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400">
            {totalOverlay}
          </div>
        </Card>

        <Card className="p-3.5 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
            Active Endpoints
          </span>
          <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {totalContainersAttached}
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-[#23232A] rounded-xl p-3 transition-colors">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            variant={driverFilter === 'all' ? 'surface' : 'ghost'}
            size="sm"
            onClick={() => setDriverFilter('all')}
            className={driverFilter === 'all' ? 'shadow-sm' : 'text-zinc-500'}
          >
            All ({networks.length})
          </Button>

          <Button
            variant={driverFilter === 'bridge' ? 'surface' : 'ghost'}
            size="sm"
            onClick={() => setDriverFilter('bridge')}
            className={driverFilter === 'bridge' ? 'shadow-sm' : 'text-zinc-500'}
          >
            Bridge ({totalBridge})
          </Button>

          <Button
            variant={driverFilter === 'overlay' ? 'surface' : 'ghost'}
            size="sm"
            onClick={() => setDriverFilter('overlay')}
            className={driverFilter === 'overlay' ? 'shadow-sm' : 'text-zinc-500'}
          >
            Overlay ({totalOverlay})
          </Button>

          <Button
            variant={driverFilter === 'host_null' ? 'surface' : 'ghost'}
            size="sm"
            onClick={() => setDriverFilter('host_null')}
            className={driverFilter === 'host_null' ? 'shadow-sm' : 'text-zinc-500'}
          >
            Host / Null
          </Button>

          <Button
            variant={driverFilter === 'custom' ? 'surface' : 'ghost'}
            size="sm"
            onClick={() => setDriverFilter('custom')}
            className={driverFilter === 'custom' ? 'shadow-sm' : 'text-zinc-500'}
          >
            Custom Only
          </Button>
        </div>

        <div className="relative w-full sm:w-64">
          <IconSearch className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 z-10 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search networks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8"
          />
        </div>
      </div>

      {/* Networks Table */}
      <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-zinc-200 dark:border-[#1F1F24] bg-zinc-50/70 dark:bg-[#0E0E12] text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              <TableHead className="py-3 px-4">Network Name & ID</TableHead>
              <TableHead className="py-3 px-4">Driver</TableHead>
              <TableHead className="py-3 px-4">Scope</TableHead>
              <TableHead className="py-3 px-4">IPv4 Subnet & Gateway</TableHead>
              <TableHead className="py-3 px-4">Containers</TableHead>
              <TableHead className="py-3 px-4">Attributes</TableHead>
              <TableHead className="py-3 px-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-zinc-100 dark:divide-[#1C1C22]">
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-zinc-500 text-xs">
                  Loading Docker networks...
                </TableCell>
              </TableRow>
            )}

            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center">
                  <IconNetwork className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-2" />
                  <p className="text-zinc-800 dark:text-zinc-300 font-medium">No networks found</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Create a custom network or change your filter query.
                  </p>
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              filtered.map((net) => {
                const isSystem = SYSTEM_NETWORKS.has(net.Name.toLowerCase());
                const shortId = net.Id.substring(0, 12);
                const ipamConfig = net.IPAM?.Config?.[0];
                const containerCount = net.Containers ? Object.keys(net.Containers).length : 0;

                return (
                  <TableRow
                    key={net.Id}
                    className="hover:bg-zinc-50 dark:hover:bg-[#16161D] transition-colors group select-text"
                  >
                    {/* Name & Short ID */}
                    <TableCell className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-[#16161E] border border-blue-200 dark:border-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold shrink-0">
                          <IconNetwork className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              onClick={() => navigate(`/networks/${net.Id}`)}
                              className="font-bold text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer font-mono text-xs transition-colors"
                            >
                              {net.Name}
                            </span>
                            {isSystem && (
                              <Badge variant="neutral" className="text-[9px]">
                                System
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                              {shortId}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(net.Id, net.Id)}
                              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                              title="Copy Full ID"
                            >
                              {copiedId === net.Id ? (
                                <IconCheck className="w-2.5 h-2.5 text-emerald-500" />
                              ) : (
                                <IconCopy className="w-2.5 h-2.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Driver */}
                    <TableCell className="py-3.5 px-4 whitespace-nowrap">
                      <Badge
                        variant={
                          net.Driver === 'bridge'
                            ? 'neutral'
                            : net.Driver === 'overlay'
                            ? 'warning'
                            : 'outline'
                        }
                        className="font-mono text-[10px]"
                      >
                        {net.Driver}
                      </Badge>
                    </TableCell>

                    {/* Scope */}
                    <TableCell className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-mono text-zinc-600 dark:text-zinc-400 text-[11px] capitalize">
                        {net.Scope}
                      </span>
                    </TableCell>

                    {/* IPv4 Subnet & Gateway */}
                    <TableCell className="py-3.5 px-4 whitespace-nowrap">
                      {ipamConfig?.Subnet ? (
                        <div className="flex flex-col font-mono text-[11px]">
                          <span className="text-zinc-800 dark:text-zinc-200 font-medium">
                            {ipamConfig.Subnet}
                          </span>
                          {ipamConfig.Gateway && (
                            <span className="text-[10px] text-zinc-400">
                              gw: {ipamConfig.Gateway}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-400 text-[11px]">—</span>
                      )}
                    </TableCell>

                    {/* Containers Count */}
                    <TableCell className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <IconBox className="w-3.5 h-3.5 text-zinc-400" />
                        <span
                          className={
                            containerCount > 0
                              ? 'font-bold text-zinc-800 dark:text-zinc-200'
                              : 'text-zinc-400'
                          }
                        >
                          {containerCount}
                        </span>
                      </div>
                    </TableCell>

                    {/* Attributes */}
                    <TableCell className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {net.Internal && (
                          <Badge variant="warning" className="text-[10px] gap-1">
                            <IconShieldLock className="w-2.5 h-2.5" />
                            Internal
                          </Badge>
                        )}
                        {net.Attachable && (
                          <Badge variant="neutral" className="text-[10px] gap-1">
                            <IconArrowsJoin className="w-2.5 h-2.5" />
                            Attachable
                          </Badge>
                        )}
                        {!net.Internal && !net.Attachable && (
                          <span className="text-zinc-400 text-[10px]">—</span>
                        )}
                      </div>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-3.5 px-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="surface"
                          size="sm"
                          onClick={() => navigate(`/networks/${net.Id}`)}
                          className="gap-1 text-xs h-7"
                        >
                          <span>Inspect</span>
                          <IconArrowRight className="w-3 h-3 text-zinc-400" />
                        </Button>

                        {!isSystem && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDelete(net.Id, net.Name)}
                            className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 h-7 w-7"
                            title="Delete Network"
                          >
                            <IconTrash className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </Card>

      {/* Create Network Modal */}
      <CreateNetworkModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(id) => navigate(`/networks/${id}`)}
      />
    </div>
  );
}

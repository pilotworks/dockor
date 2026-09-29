import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useNetwork,
  useDeleteNetwork,
  useConnectNetwork,
  useDisconnectNetwork,
} from '../../hooks/use-networks';
import { useContainers } from '../../hooks/use-containers';
import {
  IconArrowLeft,
  IconNetwork,
  IconTrash,
  IconCopy,
  IconCheck,
  IconShieldLock,
  IconArrowsJoin,
  IconExternalLink,
  IconBox,
  IconPlus,
  IconLoader2,
  IconUnlink,
  IconRoute,
  IconAdjustments,
  IconTags,
  IconCode,
} from '@tabler/icons-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { toast } from 'sonner';

const SYSTEM_NETWORKS = new Set(['bridge', 'host', 'none']);

type ActiveTab = 'containers' | 'ipam' | 'options' | 'labels' | 'inspect';

export function NetworkDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: network, isLoading, error, refetch } = useNetwork(id);
  const { data: allContainers = [] } = useContainers();

  const deleteMutation = useDeleteNetwork();
  const connectMutation = useConnectNetwork();
  const disconnectMutation = useDisconnectNetwork();

  const [activeTab, setActiveTab] = useState<ActiveTab>('containers');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [selectedContainerId, setSelectedContainerId] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const isSystem = network ? SYSTEM_NETWORKS.has(network.Name.toLowerCase()) : false;

  const handleDelete = async () => {
    if (!id || !network) return;
    if (isSystem) {
      toast.error(`System network "${network.Name}" cannot be removed`);
      return;
    }

    if (confirm(`Are you sure you want to delete network "${network.Name}"?`)) {
      setIsActionLoading(true);
      try {
        await deleteMutation.mutateAsync(id);
        toast.success(`Network "${network.Name}" deleted`);
        navigate('/networks');
      } catch (err: any) {
        toast.error('Failed to delete network', { description: err.message });
        setIsActionLoading(false);
      }
    }
  };

  const handleConnectContainer = async () => {
    if (!id || !selectedContainerId) return;
    setIsActionLoading(true);
    try {
      await connectMutation.mutateAsync({
        networkId: id,
        containerId: selectedContainerId,
      });
      toast.success('Container attached to network successfully');
      setIsConnectModalOpen(false);
      setSelectedContainerId('');
      refetch();
    } catch (err: any) {
      toast.error('Failed to attach container', { description: err.message });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDisconnectContainer = async (containerId: string, containerName: string) => {
    if (!id) return;
    if (confirm(`Disconnect container "${containerName}" from this network?`)) {
      try {
        await disconnectMutation.mutateAsync({
          networkId: id,
          containerId,
          force: true,
        });
        toast.success(`Container "${containerName}" disconnected`);
        refetch();
      } catch (err: any) {
        toast.error('Failed to disconnect container', { description: err.message });
      }
    }
  };

  // Connected containers list from network.Containers
  const connectedContainersList = useMemo(() => {
    if (!network?.Containers) return [];
    return Object.entries(network.Containers).map(([cId, endpoint]) => ({
      id: cId,
      ...endpoint,
    }));
  }, [network?.Containers]);

  // Containers not yet connected to this network
  const unconnectedContainers = useMemo(() => {
    if (!network?.Containers) return allContainers;
    const connectedIds = new Set(Object.keys(network.Containers));
    return allContainers.filter((c) => !connectedIds.has(c.id));
  }, [allContainers, network?.Containers]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <IconLoader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-xs text-zinc-500 font-mono">Loading Docker network details...</p>
      </div>
    );
  }

  if (error || !network) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/networks')} className="gap-2">
          <IconArrowLeft className="w-4 h-4" />
          Back to Networks
        </Button>
        <Card className="border-dashed border-red-300 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-12 text-center">
          <IconNetwork className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Network Not Found</h3>
          <p className="text-xs text-zinc-500 mt-1">
            The requested Docker network could not be located or may have been deleted.
          </p>
          <Button size="sm" variant="surface" className="mt-4" onClick={() => navigate('/networks')}>
            View All Networks
          </Button>
        </Card>
      </div>
    );
  }

  const ipamConfig = network.IPAM?.Config?.[0];

  return (
    <div className="space-y-5">
      {/* Top Breadcrumb & Quick Actions Bar */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/networks')}
            className="gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <IconArrowLeft className="w-4 h-4" />
            Back to Networks
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="surface"
              size="sm"
              onClick={() => setIsConnectModalOpen(true)}
              className="gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700"
            >
              <IconPlus className="w-3.5 h-3.5" />
              Connect Container
            </Button>

            {!isSystem && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleDelete}
                disabled={isActionLoading}
                className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                title="Delete Network"
              >
                <IconTrash className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Hero Card */}
        <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner shrink-0">
                <IconNetwork className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-mono">{network.Name}</h1>
                  <Badge
                    variant={
                      network.Driver === 'bridge'
                        ? 'neutral'
                        : network.Driver === 'overlay'
                        ? 'warning'
                        : 'outline'
                    }
                    className="font-mono text-xs uppercase"
                  >
                    {network.Driver}
                  </Badge>
                  {isSystem && (
                    <Badge variant="neutral" className="text-[10px]">
                      System Default
                    </Badge>
                  )}
                  {network.Internal && (
                    <Badge variant="warning" className="text-[10px] gap-1">
                      <IconShieldLock className="w-2.5 h-2.5" />
                      Internal
                    </Badge>
                  )}
                  {network.Attachable && (
                    <Badge variant="neutral" className="text-[10px] gap-1">
                      <IconArrowsJoin className="w-2.5 h-2.5" />
                      Attachable
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                  <div className="flex items-center gap-1">
                    <span>ID: {network.Id.substring(0, 12)}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(network.Id, 'net-id')}
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      title="Copy full network ID"
                    >
                      {copiedKey === 'net-id' ? (
                        <IconCheck className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <IconCopy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <span>Scope: <strong className="text-zinc-700 dark:text-zinc-300 capitalize">{network.Scope}</strong></span>
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <span>Created: {new Date(network.Created).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Quick Stat Counter */}
            <div className="flex items-center gap-3 bg-zinc-50 dark:bg-[#0A0A0E] border border-zinc-200 dark:border-[#1E1E24] px-4 py-2.5 rounded-xl self-start md:self-auto font-mono">
              <div className="text-center">
                <div className="text-[10px] uppercase font-semibold text-zinc-400">Attached</div>
                <div className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                  {connectedContainersList.length}
                </div>
              </div>
              <div className="w-px h-7 bg-zinc-200 dark:bg-[#202026]" />
              <div className="text-center">
                <div className="text-[10px] uppercase font-semibold text-zinc-400">Subnet</div>
                <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                  {ipamConfig?.Subnet || 'None'}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-[#23232A]">
        <button
          onClick={() => setActiveTab('containers')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'containers'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-semibold'
              : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <IconBox className="w-4 h-4" />
          <span>Connected Containers</span>
          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-[#1E1E24] text-zinc-600 dark:text-zinc-300 font-mono">
            {connectedContainersList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('ipam')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'ipam'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-semibold'
              : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <IconRoute className="w-4 h-4" />
          <span>IPAM & Routing</span>
        </button>

        <button
          onClick={() => setActiveTab('options')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'options'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-semibold'
              : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <IconAdjustments className="w-4 h-4" />
          <span>Driver Options</span>
          {network.Options && Object.keys(network.Options).length > 0 && (
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-[#1E1E24] text-zinc-600 dark:text-zinc-300 font-mono">
              {Object.keys(network.Options).length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('labels')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'labels'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-semibold'
              : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <IconTags className="w-4 h-4" />
          <span>Labels & Metadata</span>
        </button>

        <button
          onClick={() => setActiveTab('inspect')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'inspect'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-semibold'
              : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <IconCode className="w-4 h-4" />
          <span>Raw JSON Inspect</span>
        </button>
      </div>

      {/* Tab 1: Connected Containers */}
      {activeTab === 'containers' && (
        <div className="space-y-4">
          {connectedContainersList.length === 0 ? (
            <Card className="p-12 text-center bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A]">
              <IconBox className="w-10 h-10 text-zinc-400 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">No Containers Attached</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
                No active endpoints are currently connected to network &quot;{network.Name}&quot;. Connect an existing container to establish IP routes.
              </p>
              <Button
                size="sm"
                variant="primary"
                onClick={() => setIsConnectModalOpen(true)}
                className="mt-4 gap-1.5"
              >
                <IconPlus className="w-3.5 h-3.5" />
                Connect Container
              </Button>
            </Card>
          ) : (
            <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-[#1F1F24] bg-zinc-50/70 dark:bg-[#0E0E12] text-[10px] uppercase text-zinc-500 dark:text-zinc-400">
                      <th className="py-3 px-4">Container Name</th>
                      <th className="py-3 px-4">IPv4 Address</th>
                      <th className="py-3 px-4">MAC Address</th>
                      <th className="py-3 px-4">Endpoint ID</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-[#1C1C22]">
                    {connectedContainersList.map((endpoint) => {
                      const shortCId = endpoint.id.substring(0, 12);
                      const shortEpId = endpoint.EndpointID.substring(0, 12);

                      return (
                        <tr
                          key={endpoint.id}
                          className="hover:bg-zinc-50 dark:hover:bg-[#16161D] transition-colors"
                        >
                          <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                            <div className="flex items-center gap-2">
                              <span
                                onClick={() => navigate(`/containers/${endpoint.id}`)}
                                className="hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                                title="Open Container Details"
                              >
                                {endpoint.Name}
                              </span>
                              <span className="text-[10px] text-zinc-400 font-normal">({shortCId})</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-blue-600 dark:text-blue-400 font-medium">
                            {endpoint.IPv4Address || '—'}
                          </td>
                          <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                            {endpoint.MacAddress || '—'}
                          </td>
                          <td className="py-3 px-4 text-zinc-400 text-[11px]">
                            {shortEpId}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="surface"
                                size="sm"
                                onClick={() => navigate(`/containers/${endpoint.id}`)}
                                className="gap-1 text-xs h-7"
                              >
                                <span>Inspect</span>
                                <IconExternalLink className="w-3 h-3 text-zinc-400" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleDisconnectContainer(endpoint.id, endpoint.Name)}
                                className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 h-7 w-7"
                                title="Disconnect from network"
                              >
                                <IconUnlink className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Tab 2: IPAM & Routing */}
      {activeTab === 'ipam' && (
        <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              IP Address Management (IPAM)
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Subnet CIDR blocks, gateway routing endpoints, and IP assignment ranges.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-zinc-50 dark:bg-[#0A0A0E] border border-zinc-200 dark:border-[#202026] rounded-xl p-3.5 font-mono">
              <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
                IPAM Driver
              </span>
              <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                {network.IPAM?.Driver || 'default'}
              </span>
            </div>

            <div className="bg-zinc-50 dark:bg-[#0A0A0E] border border-zinc-200 dark:border-[#202026] rounded-xl p-3.5 font-mono">
              <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
                Subnet CIDR
              </span>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                {ipamConfig?.Subnet || 'None allocated'}
              </span>
            </div>

            <div className="bg-zinc-50 dark:bg-[#0A0A0E] border border-zinc-200 dark:border-[#202026] rounded-xl p-3.5 font-mono">
              <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
                Default Gateway
              </span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {ipamConfig?.Gateway || 'None'}
              </span>
            </div>
          </div>

          {ipamConfig?.IPRange && (
            <div className="bg-zinc-50 dark:bg-[#0A0A0E] border border-zinc-200 dark:border-[#202026] rounded-xl p-3.5 font-mono">
              <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
                Allocated IP Range
              </span>
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                {ipamConfig.IPRange}
              </span>
            </div>
          )}
        </Card>
      )}

      {/* Tab 3: Driver Options */}
      {activeTab === 'options' && (
        <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Network Driver Parameters
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Specific flags configured for driver `{network.Driver}`.
            </p>
          </div>

          {!network.Options || Object.keys(network.Options).length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500 border border-dashed border-zinc-200 dark:border-[#202026] rounded-xl">
              No custom driver options set for this network.
            </div>
          ) : (
            <div className="border border-zinc-200 dark:border-[#23232A] rounded-xl overflow-hidden divide-y divide-zinc-200 dark:divide-[#23232A]">
              {Object.entries(network.Options).map(([key, val]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 bg-zinc-50/50 dark:bg-[#0A0A0E]/50 font-mono text-xs"
                >
                  <span className="font-semibold text-blue-600 dark:text-blue-400">{key}</span>
                  <span className="text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-[#1A1A22] px-2 py-0.5 rounded border border-zinc-200 dark:border-[#272730]">
                    {val}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tab 4: Labels & Metadata */}
      {activeTab === 'labels' && (
        <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Labels & Metadata
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Docker labels and system properties.
            </p>
          </div>

          {!network.Labels || Object.keys(network.Labels).length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500 border border-dashed border-zinc-200 dark:border-[#202026] rounded-xl">
              No labels attached to this network.
            </div>
          ) : (
            <div className="border border-zinc-200 dark:border-[#23232A] rounded-xl overflow-hidden divide-y divide-zinc-200 dark:divide-[#23232A]">
              {Object.entries(network.Labels).map(([key, val]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 bg-zinc-50/50 dark:bg-[#0A0A0E]/50 font-mono text-xs"
                >
                  <span className="font-semibold text-purple-600 dark:text-purple-400">{key}</span>
                  <span className="text-zinc-800 dark:text-zinc-200">{val}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tab 5: Raw JSON Inspect */}
      {activeTab === 'inspect' && (
        <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Docker Engine Network Inspect JSON
            </span>
            <Button
              variant="surface"
              size="sm"
              onClick={() => copyToClipboard(JSON.stringify(network, null, 2), 'json')}
              className="gap-1.5 text-xs h-7"
            >
              {copiedKey === 'json' ? (
                <IconCheck className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <IconCopy className="w-3.5 h-3.5" />
              )}
              Copy JSON
            </Button>
          </div>
          <div className="bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 overflow-auto max-h-[65vh]">
            <pre className="text-xs font-mono text-zinc-800 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {JSON.stringify(network, null, 2)}
            </pre>
          </div>
        </Card>
      )}

      {/* Connect Container Modal */}
      <Dialog open={isConnectModalOpen} onOpenChange={setIsConnectModalOpen}>
        <DialogContent className="max-w-md p-0 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#272730] shadow-2xl rounded-2xl overflow-hidden transition-colors">
          <DialogHeader className="px-6 py-4 border-b border-zinc-200 dark:border-[#1F1F24] bg-zinc-50 dark:bg-[#0A0A0D]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-[#16161E] border border-blue-200 dark:border-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <IconNetwork className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Connect Container to Network
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500 mt-0.5">
                  Attach an existing container to `{network.Name}`.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Select Container
              </label>
              {unconnectedContainers.length === 0 ? (
                <p className="text-xs text-zinc-500">All running containers are already attached.</p>
              ) : (
                <Select value={selectedContainerId} onValueChange={setSelectedContainerId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choose a container..." />
                  </SelectTrigger>
                  <SelectContent>
                    {unconnectedContainers.map((c) => {
                      const name = c.names?.[0]?.replace(/^\//, '') || c.id.substring(0, 10);
                      return (
                        <SelectItem key={c.id} value={c.id}>
                          {name} ({c.id.substring(0, 8)}) - {c.state}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-[#1E1E24]">
              <Button variant="ghost" size="sm" onClick={() => setIsConnectModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConnectContainer}
                disabled={!selectedContainerId || isActionLoading}
                className="gap-1.5"
              >
                {isActionLoading && <IconLoader2 className="w-3.5 h-3.5 animate-spin" />}
                Connect
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

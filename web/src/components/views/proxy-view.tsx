import { useState, useMemo } from 'react';
import {
  IconWorld,
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconShieldLock,
  IconExternalLink,
  IconCheck,
  IconFileCode,
  IconLink,
  IconCopy,
  IconRotateClockwise,
} from '@tabler/icons-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/table';
import { toast } from 'sonner';
import {
  useProxyRoutes,
  useProxyStatus,
  useToggleProxyRoute,
  useDeleteProxyRoute,
  useSyncProxy,
} from '../../hooks/use-proxy';
import { ProxyRouteModal } from '../proxy/proxy-route-modal';
import { CaddyfileModal } from '../proxy/caddyfile-modal';
import { confirmDialog } from '../../stores/use-dialog-store';
import { ProxyRoute } from '../../types';

export function ProxyView() {
  const { data: routes = [], isLoading, refetch } = useProxyRoutes();
  const { data: status, refetch: refetchStatus } = useProxyStatus();

  const toggleMutation = useToggleProxyRoute();
  const deleteMutation = useDeleteProxyRoute();
  const syncMutation = useSyncProxy();

  const [searchQuery, setSearchQuery] = useState('');
  const [sslFilter, setSslFilter] = useState<string>('all');
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [isCaddyfileModalOpen, setIsCaddyfileModalOpen] = useState(false);
  const [routeToEdit, setRouteToEdit] = useState<ProxyRoute | null>(null);

  const filteredRoutes = useMemo(() => {
    return routes.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.domain.toLowerCase().includes(q) ||
        r.target_url.toLowerCase().includes(q);

      const matchesSSL = sslFilter === 'all' || r.ssl_mode === sslFilter;

      return matchesSearch && matchesSSL;
    });
  }, [routes, searchQuery, sslFilter]);

  const activeRoutesCount = useMemo(() => routes.filter((r) => r.enabled).length, [routes]);

  const handleCreate = () => {
    setRouteToEdit(null);
    setIsRouteModalOpen(true);
  };

  const handleEdit = (route: ProxyRoute) => {
    setRouteToEdit(route);
    setIsRouteModalOpen(true);
  };

  const handleToggle = async (route: ProxyRoute, newEnabled: boolean) => {
    try {
      await toggleMutation.mutateAsync({ id: route.id, enabled: newEnabled });
      toast.success(`Route "${route.domain}" ${newEnabled ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      toast.error('Failed to toggle route: ' + err.message);
    }
  };

  const handleDelete = async (route: ProxyRoute) => {
    const confirmed = await confirmDialog({
      title: 'Delete Proxy Route',
      description: `Are you sure you want to delete routing for domain "${route.domain}"? Incoming traffic will no longer be forwarded.`,
      confirmText: 'Delete Route',
      variant: 'destructive',
    });

    if (confirmed) {
      try {
        await deleteMutation.mutateAsync(route.id);
        toast.success(`Proxy route "${route.domain}" deleted`);
      } catch (err: any) {
        toast.error('Failed to delete route: ' + err.message);
      }
    }
  };

  const handleForceSync = async () => {
    try {
      await syncMutation.mutateAsync();
      refetch();
      refetchStatus();
      toast.success('Caddy reverse proxy reloaded and synchronized successfully');
    } catch (err: any) {
      toast.error('Sync failed: ' + err.message);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Reverse Proxy & Automated SSL
            </h1>
            <Badge variant="neutral" className="text-xs font-mono font-normal">
              {routes.length} domain{routes.length === 1 ? '' : 's'}
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Integrated Caddy engine providing zero-touch Let&apos;s Encrypt HTTPS, custom domains, and transparent HTTP/2 & WebSocket proxying.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="surface"
            size="sm"
            onClick={handleForceSync}
            disabled={syncMutation.isPending}
            className="gap-1.5 text-xs"
            title="Hot reload Caddy daemon configuration"
          >
            <IconRotateClockwise
              className={`w-3.5 h-3.5 ${syncMutation.isPending ? 'animate-spin text-blue-500' : ''}`}
            />
            <span>{syncMutation.isPending ? 'Reloading...' : 'Sync Caddy'}</span>
          </Button>

          <Button
            variant="surface"
            size="sm"
            onClick={() => setIsCaddyfileModalOpen(true)}
            className="gap-1.5 text-xs"
            title="View generated Caddyfile configuration"
          >
            <IconFileCode className="w-3.5 h-3.5 text-purple-500" />
            <span>Caddyfile</span>
          </Button>

          <Button variant="primary" size="sm" onClick={handleCreate} className="gap-1.5 text-xs">
            <IconPlus className="w-4 h-4" />
            <span>Add Route</span>
          </Button>
        </div>
      </div>

      {/* Status Hero Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A]">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase text-zinc-400">
                Daemon Status
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    status?.running ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {status?.running ? 'Caddy Live (Admin API)' : 'Synced to Disk'}
                </span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <IconWorld className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2 truncate">
            {status?.running
              ? `Hot reload active on ${status?.admin_url || 'localhost:2019'}`
              : 'Config saved to Caddyfile (Ready for daemon startup)'}
          </p>
        </Card>

        <Card className="p-4 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A]">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase text-zinc-400">
                Active Proxy Routes
              </span>
              <div className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                {activeRoutesCount} <span className="text-xs text-zinc-400 font-normal">/ {routes.length} total</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <IconCheck className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">
            Incoming domains actively routing traffic
          </p>
        </Card>

        <Card className="p-4 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A]">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase text-zinc-400">
                Automated SSL
              </span>
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Let&apos;s Encrypt / ACME
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <IconShieldLock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">
            Zero-configuration SSL renewal and certificate management
          </p>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <Input
            placeholder="Search domain or upstream..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-500 mr-1">SSL:</span>
          {['all', 'letsencrypt', 'internal', 'disabled'].map((mode) => (
            <button
              key={mode}
              onClick={() => setSslFilter(mode)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                sslFilter === mode
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-[#181820] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              {mode === 'letsencrypt' ? "Let's Encrypt" : mode}
            </button>
          ))}
        </div>
      </div>

      {/* Routes Table */}
      <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-zinc-500 font-mono">
            Loading reverse proxy routes...
          </div>
        ) : filteredRoutes.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-[#181820] flex items-center justify-center mx-auto text-zinc-400">
              <IconWorld className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {searchQuery || sslFilter !== 'all' ? 'No Matching Routes' : 'No Proxy Routes Defined'}
              </h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                {searchQuery || sslFilter !== 'all'
                  ? 'Try adjusting your search criteria.'
                  : 'Connect your first public domain or local development hostname to internal container services.'}
              </p>
            </div>
            {!searchQuery && sslFilter === 'all' && (
              <Button size="sm" variant="primary" onClick={handleCreate} className="gap-1.5 text-xs">
                <IconPlus className="w-4 h-4" />
                Add First Route
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Public Domain</TableHead>
                  <TableHead className="w-[20%]">SSL Mode</TableHead>
                  <TableHead className="w-[25%]">Target Upstream</TableHead>
                  <TableHead className="w-[10%] text-center">Status</TableHead>
                  <TableHead className="w-[15%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoutes.map((route) => {
                  const isHttps = route.ssl_mode !== 'disabled';
                  const domainUrl = `${isHttps ? 'https' : 'http'}://${route.domain}`;

                  return (
                    <TableRow key={route.id} className="hover:bg-zinc-50/70 dark:hover:bg-[#16161D]/70 transition-colors">
                      {/* Domain Column */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <a
                            href={domainUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 group"
                          >
                            <span>{route.domain}</span>
                            <IconExternalLink className="w-3 h-3 text-zinc-400 group-hover:text-blue-500" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopy(route.domain, 'domain')}
                            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors p-0.5"
                            title="Copy domain"
                          >
                            <IconCopy className="w-3 h-3" />
                          </button>
                        </div>
                        {route.email && (
                          <div className="text-[10px] text-zinc-400 mt-0.5">
                            ACME: {route.email}
                          </div>
                        )}
                      </TableCell>

                      {/* SSL Mode Column */}
                      <TableCell>
                        {route.ssl_mode === 'letsencrypt' ? (
                          <Badge variant="success" dot className="text-[10px]">
                            Let&apos;s Encrypt
                          </Badge>
                        ) : route.ssl_mode === 'internal' ? (
                          <Badge variant="info" dot className="text-[10px]">
                            Internal CA
                          </Badge>
                        ) : route.ssl_mode === 'custom' ? (
                          <Badge variant="neutral" dot className="text-[10px]">
                            Custom TLS
                          </Badge>
                        ) : (
                          <Badge variant="warning" className="text-[10px]">
                            HTTP Only
                          </Badge>
                        )}
                      </TableCell>

                      {/* Target Upstream Column */}
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                          <IconLink className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="truncate">{route.target_url}</span>
                        </div>
                      </TableCell>

                      {/* Status Toggle Column */}
                      <TableCell className="text-center">
                        <Switch
                          checked={route.enabled}
                          onCheckedChange={(checked) => handleToggle(route, checked)}
                          disabled={toggleMutation.isPending}
                        />
                      </TableCell>

                      {/* Actions Column */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleEdit(route)}
                            title="Edit route"
                          >
                            <IconEdit className="w-4 h-4 text-zinc-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDelete(route)}
                            className="text-zinc-400 hover:text-red-500"
                            title="Delete route"
                          >
                            <IconTrash className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Add / Edit Route Modal */}
      <ProxyRouteModal
        isOpen={isRouteModalOpen}
        onClose={() => setIsRouteModalOpen(false)}
        routeToEdit={routeToEdit}
      />

      {/* View Caddyfile Modal */}
      <CaddyfileModal
        isOpen={isCaddyfileModalOpen}
        onClose={() => setIsCaddyfileModalOpen(false)}
      />
    </div>
  );
}

import { useState, useEffect } from 'react';
import {
  IconX,
  IconWorld,
  IconShieldLock,
  IconPlus,
  IconDeviceFloppy,
  IconBox,
} from '@tabler/icons-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Switch } from '../ui/switch';
import { useCreateProxyRoute, useUpdateProxyRoute } from '../../hooks/use-proxy';
import { useContainers } from '../../hooks/use-containers';
import { ProxyRoute, SSLMode } from '../../types';
import { toast } from 'sonner';

interface ProxyRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  routeToEdit: ProxyRoute | null;
}

export function ProxyRouteModal({ isOpen, onClose, routeToEdit }: ProxyRouteModalProps) {
  const [domain, setDomain] = useState('');
  const [targetURL, setTargetURL] = useState('');
  const [sslMode, setSslMode] = useState<SSLMode>('letsencrypt');
  const [email, setEmail] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [selectedContainerId, setSelectedContainerId] = useState<string>('');

  const { data: containers = [] } = useContainers();
  const createMutation = useCreateProxyRoute();
  const updateMutation = useUpdateProxyRoute();

  const isEditing = Boolean(routeToEdit);

  useEffect(() => {
    if (routeToEdit) {
      setDomain(routeToEdit.domain);
      setTargetURL(routeToEdit.target_url);
      setSslMode(routeToEdit.ssl_mode || 'letsencrypt');
      setEmail(routeToEdit.email || '');
      setEnabled(routeToEdit.enabled);
      setSelectedContainerId(routeToEdit.container_id || '');
    } else {
      setDomain('');
      setTargetURL('localhost:8080');
      setSslMode('letsencrypt');
      setEmail('');
      setEnabled(true);
      setSelectedContainerId('');
    }
  }, [routeToEdit, isOpen]);

  if (!isOpen) return null;

  // Handle auto-filling target upstream from a selected container
  const handleSelectContainer = (containerId: string) => {
    setSelectedContainerId(containerId);
    const container = containers.find((c) => c.id === containerId);
    if (!container) return;

    const cName = container.names?.[0]?.replace(/^\//, '') || container.id.substring(0, 12);

    // Pick first public or private port
    const port = container.ports?.[0];
    if (port?.public_port) {
      setTargetURL(`localhost:${port.public_port}`);
    } else if (port?.private_port) {
      setTargetURL(`${cName}:${port.private_port}`);
    } else {
      setTargetURL(`${cName}:80`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '');
    const cleanTarget = targetURL.trim();

    if (!cleanDomain) {
      toast.error('Domain is required');
      return;
    }
    if (!cleanTarget) {
      toast.error('Target upstream URL is required');
      return;
    }

    try {
      if (isEditing && routeToEdit) {
        await updateMutation.mutateAsync({
          id: routeToEdit.id,
          payload: {
            domain: cleanDomain,
            target_url: cleanTarget,
            ssl_mode: sslMode,
            email: email.trim() || undefined,
            enabled,
            container_id: selectedContainerId || undefined,
          },
        });
        toast.success(`Proxy route "${cleanDomain}" updated`);
      } else {
        await createMutation.mutateAsync({
          domain: cleanDomain,
          target_url: cleanTarget,
          ssl_mode: sslMode,
          email: email.trim() || undefined,
          enabled,
          container_id: selectedContainerId || undefined,
        });
        toast.success(`Proxy route "${cleanDomain}" created`);
      }
      onClose();
    } catch (err: any) {
      toast.error('Failed to save proxy route: ' + err.message);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-[#23232A] p-6 shadow-2xl space-y-5 text-zinc-900 dark:text-zinc-100 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
              <IconWorld className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold">
                {isEditing ? 'Edit Reverse Proxy Route' : 'Add Reverse Proxy Route'}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Route incoming domain traffic to internal container services with automatic SSL.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors p-1"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Domain Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Domain Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Input
                placeholder="e.g. app.example.com or local.test"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="font-mono text-xs pl-8"
                required
              />
              <IconWorld className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            </div>
            <p className="text-[11px] text-zinc-500">
              Points DNS A/CNAME record to this server or use a local hostname.
            </p>
          </div>

          {/* Quick Select Container Helper */}
          {containers.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <IconBox className="w-3.5 h-3.5 text-zinc-500" />
                <span>Link Running Container (Optional Preset)</span>
              </label>
              <Select value={selectedContainerId} onValueChange={handleSelectContainer}>
                <SelectTrigger className="w-full text-xs h-9">
                  <SelectValue placeholder="Choose a running container..." />
                </SelectTrigger>
                <SelectContent>
                  {containers.map((c) => {
                    const cName = c.names?.[0]?.replace(/^\//, '') || c.id.substring(0, 8);
                    const portsText = c.ports?.map((p) => p.public_port || p.private_port).join(', ');
                    return (
                      <SelectItem key={c.id} value={c.id}>
                        {cName} ({c.state}) {portsText ? `• :${portsText}` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Target Upstream */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Target Upstream Address <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g. localhost:8080 or container_name:3000"
              value={targetURL}
              onChange={(e) => setTargetURL(e.target.value)}
              className="font-mono text-xs"
              required
            />
            <p className="text-[11px] text-zinc-500">
              The internal destination Caddy forwards incoming traffic to.
            </p>
          </div>

          {/* SSL Mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <IconShieldLock className="w-3.5 h-3.5 text-emerald-500" />
              <span>TLS / SSL Mode</span>
            </label>
            <Select value={sslMode} onValueChange={(val) => setSslMode(val as SSLMode)}>
              <SelectTrigger className="w-full text-xs h-9">
                <SelectValue placeholder="Select SSL mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="letsencrypt">
                  Let&apos;s Encrypt / ZeroSSL (Automated Public HTTPS)
                </SelectItem>
                <SelectItem value="internal">
                  Self-Signed / Internal Local CA (Local Development)
                </SelectItem>
                <SelectItem value="disabled">
                  Disabled (Plain HTTP Only)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Optional Let's Encrypt Email */}
          {sslMode === 'letsencrypt' && (
            <div className="space-y-1.5 animate-in fade-in duration-150">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                ACME Contact Email (Optional)
              </label>
              <Input
                type="email"
                placeholder="e.g. admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-xs"
              />
              <p className="text-[11px] text-zinc-500">
                Used by Let&apos;s Encrypt to notify of certificate renewal notices.
              </p>
            </div>
          )}

          {/* Enabled Switch */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-[#14141A] border border-zinc-200 dark:border-[#23232A]">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Route Active
              </span>
              <p className="text-[11px] text-zinc-500">
                When enabled, Caddy actively listens and proxies requests for this domain.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-200 dark:border-[#23232A]">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isPending} className="gap-1.5">
              {isEditing ? <IconDeviceFloppy className="w-4 h-4" /> : <IconPlus className="w-4 h-4" />}
              <span>{isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Route'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

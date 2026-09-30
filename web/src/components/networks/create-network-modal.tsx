import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { IconNetwork, IconPlus, IconLoader2, IconShieldLock } from '@tabler/icons-react';
import { toast } from 'sonner';
import { useCreateNetwork } from '../../hooks/use-networks';

interface CreateNetworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (networkId: string) => void;
}

export function CreateNetworkModal({ isOpen, onClose, onSuccess }: CreateNetworkModalProps) {
  const [name, setName] = useState('');
  const [driver, setDriver] = useState<'bridge' | 'overlay' | 'macvlan' | 'ipvlan'>('bridge');
  const [subnet, setSubnet] = useState('');
  const [gateway, setGateway] = useState('');
  const [ipRange, setIpRange] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [isAttachable, setIsAttachable] = useState(true);

  const createMutation = useCreateNetwork();

  const handleReset = () => {
    setName('');
    setDriver('bridge');
    setSubnet('');
    setGateway('');
    setIpRange('');
    setIsInternal(false);
    setIsAttachable(true);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Network name is required');
      return;
    }

    try {
      const created = await createMutation.mutateAsync({
        name: name.trim(),
        driver,
        subnet: subnet.trim() || undefined,
        gateway: gateway.trim() || undefined,
        ip_range: ipRange.trim() || undefined,
        internal: isInternal,
        attachable: isAttachable,
      });

      toast.success(`Network "${name}" created successfully`);
      handleClose();
      if (onSuccess && created?.Id) {
        onSuccess(created.Id);
      }
    } catch (err: any) {
      toast.error('Failed to create network', { description: err.message });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#272730] shadow-2xl rounded-2xl overflow-hidden transition-colors">
        <DialogHeader className="px-6 py-4 border-b border-zinc-200 dark:border-[#1F1F24] bg-zinc-50 dark:bg-[#0A0A0D]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-[#16161E] border border-blue-200 dark:border-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
              <IconNetwork className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Create Docker Network
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Define an isolated network namespace with custom driver and IPAM parameters.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Network Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Network Name <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              required
              placeholder="e.g. backend-tier, isolated-mesh"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 font-mono"
            />
          </div>

          {/* Network Driver */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Driver
            </label>
            <Select value={driver} onValueChange={(val: any) => setDriver(val)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select driver" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bridge">bridge (Standard container-to-container on single host)</SelectItem>
                <SelectItem value="overlay">overlay (Multi-host Swarm mesh networking)</SelectItem>
                <SelectItem value="macvlan">macvlan (Direct hardware MAC assignment)</SelectItem>
                <SelectItem value="ipvlan">ipvlan (L2/L3 host interface binding)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* IPAM Subnet & Gateway */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Subnet CIDR <span className="text-[10px] text-zinc-400 font-normal">(Optional)</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. 172.28.0.0/16"
                value={subnet}
                onChange={(e) => setSubnet(e.target.value)}
                className="h-9 font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Default Gateway <span className="text-[10px] text-zinc-400 font-normal">(Optional)</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. 172.28.0.1"
                value={gateway}
                onChange={(e) => setGateway(e.target.value)}
                className="h-9 font-mono text-xs"
              />
            </div>
          </div>

          {/* IP Range */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Allocated IP Range <span className="text-[10px] text-zinc-400 font-normal">(Optional)</span>
            </label>
            <Input
              type="text"
              placeholder="e.g. 172.28.5.0/24"
              value={ipRange}
              onChange={(e) => setIpRange(e.target.value)}
              className="h-9 font-mono text-xs"
            />
          </div>

          {/* Flags / Checkboxes */}
          <div className="pt-2 space-y-3 border-t border-zinc-100 dark:border-[#1E1E24]">
            <Checkbox
              checked={isInternal}
              onCheckedChange={setIsInternal}
              label={
                <span className="flex items-center gap-1.5 font-semibold text-zinc-800 dark:text-zinc-200">
                  <IconShieldLock className="w-3.5 h-3.5 text-amber-500" />
                  Internal Network (Isolated)
                </span>
              }
              description="Block outbound internet access and external ingress; only containers in this network can communicate."
            />

            <Checkbox
              checked={isAttachable}
              onCheckedChange={setIsAttachable}
              label="Enable Container Attachable"
              description="Allows manual attachment of standalone docker containers to this network."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-[#1E1E24]">
            <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={createMutation.isPending || !name.trim()}
              className="gap-1.5"
            >
              {createMutation.isPending ? (
                <IconLoader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <IconPlus className="w-3.5 h-3.5" />
              )}
              Create Network
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

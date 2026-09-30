import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { useCreateRegistry, useUpdateRegistry } from '../../hooks/use-registries';
import { Registry } from '../../types';
import { toast } from 'sonner';
import { IconDatabase, IconLock, IconLoader2, IconSparkles } from '@tabler/icons-react';

interface CreateRegistryModalProps {
  isOpen: boolean;
  onClose: () => void;
  registryToEdit?: Registry | null;
}

const PRESETS = [
  { id: 'dockerhub', name: 'Docker Hub', server: 'https://index.docker.io/v1/', hint: 'Use your Docker ID & Personal Access Token' },
  { id: 'ghcr', name: 'GitHub Packages (ghcr.io)', server: 'ghcr.io', hint: 'Use GitHub username & PAT with read:packages/write:packages' },
  { id: 'gitlab', name: 'GitLab Container Registry', server: 'registry.gitlab.com', hint: 'Use Deploy Token or Personal Access Token' },
  { id: 'quay', name: 'Quay.io', server: 'quay.io', hint: 'Use Robot Account or Quay username & token' },
  { id: 'custom', name: 'Custom Private Registry', server: '', hint: 'Self-hosted Harbor, Nexus, or Docker Registry v2' },
];

export function CreateRegistryModal({
  isOpen,
  onClose,
  registryToEdit,
}: CreateRegistryModalProps) {
  const [name, setName] = useState('');
  const [serverAddress, setServerAddress] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('dockerhub');

  const createMutation = useCreateRegistry();
  const updateMutation = useUpdateRegistry();

  useEffect(() => {
    if (registryToEdit) {
      setName(registryToEdit.name);
      setServerAddress(registryToEdit.server_address);
      setUsername(registryToEdit.username || '');
      setPassword('');
      setIsDefault(Boolean(registryToEdit.is_default));
      const found = PRESETS.find((p) => p.server === registryToEdit.server_address);
      setSelectedPreset(found ? found.id : 'custom');
    } else {
      setName('');
      setServerAddress(PRESETS[0].server);
      setUsername('');
      setPassword('');
      setIsDefault(false);
      setSelectedPreset('dockerhub');
    }
  }, [registryToEdit, isOpen]);

  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = PRESETS.find((p) => p.id === presetId);
    if (preset && preset.server) {
      setServerAddress(preset.server);
      if (!name || PRESETS.some((p) => p.name === name)) {
        setName(preset.name);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Registry name is required');
      return;
    }
    if (!serverAddress.trim()) {
      toast.error('Server address is required');
      return;
    }

    try {
      if (registryToEdit) {
        await updateMutation.mutateAsync({
          id: registryToEdit.id,
          payload: {
            name: name.trim(),
            server_address: serverAddress.trim(),
            username: username.trim(),
            password: password ? password : undefined,
            is_default: isDefault,
          },
        });
        toast.success(`Registry "${name}" updated successfully`);
      } else {
        await createMutation.mutateAsync({
          name: name.trim(),
          server_address: serverAddress.trim(),
          username: username.trim(),
          password: password,
          is_default: isDefault,
        });
        toast.success(`Registry "${name}" created successfully`);
      }
      onClose();
    } catch (err: any) {
      toast.error('Failed to save registry', { description: err.message });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#272730] shadow-2xl rounded-2xl">
        <DialogHeader className="px-6 py-4 border-b border-zinc-200 dark:border-[#1F1F24] bg-zinc-50/80 dark:bg-[#0A0A0D]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <IconDatabase className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {registryToEdit ? 'Edit Container Registry' : 'Add Container Registry'}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500 mt-0.5">
                Configure authentication for pulling and pushing container images.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {/* Registry Provider Preset */}
            {!registryToEdit && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <IconSparkles className="w-3.5 h-3.5 text-amber-500" />
                  Provider Preset
                </label>
                <Select value={selectedPreset} onValueChange={handlePresetChange}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choose provider preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESETS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Display Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Registry Name
              </label>
              <Input
                placeholder="e.g. Docker Hub, Internal Harbor"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Server Address */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Server Address URL
              </label>
              <Input
                placeholder="e.g. https://index.docker.io/v1/ or ghcr.io"
                value={serverAddress}
                onChange={(e) => setServerAddress(e.target.value)}
                required
                className="font-mono text-xs"
              />
            </div>

            {/* Username & Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Username
                </label>
                <Input
                  placeholder="Username / Robot Name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  {registryToEdit ? 'New Password / Token' : 'Password / Token'}
                </label>
                <Input
                  type="password"
                  placeholder={registryToEdit ? 'Leave blank to retain' : 'Access token / password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Security Notice */}
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 text-emerald-800 dark:text-emerald-300 text-[11px] leading-relaxed">
              <IconLock className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <span>
                Passwords and tokens are encrypted with <strong>AES-256-GCM</strong> using an isolated secret key stored separately from the database.
              </span>
            </div>

            {/* Default Registry Checkbox */}
            <div className="pt-1">
              <Checkbox
                checked={isDefault}
                onCheckedChange={(checked) => setIsDefault(checked)}
                size="sm"
                label="Set as default registry for image operations"
                description="Automatically selected when pulling or pushing images."
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-3.5 bg-zinc-50/80 dark:bg-[#0E0E12] border-t border-zinc-200 dark:border-[#1F1F24]">
            <Button type="button" variant="surface" size="sm" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isPending} className="gap-1.5">
              {isPending && <IconLoader2 className="w-3.5 h-3.5 animate-spin" />}
              {registryToEdit ? 'Save Changes' : 'Create Registry'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

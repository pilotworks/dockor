import { useState } from 'react';
import { useCreateContainer } from '../../hooks/use-containers';
import { useImages } from '../../hooks/use-images';
import { useNetworks } from '../../hooks/use-networks';
import { useVolumes } from '../../hooks/use-volumes';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  IconBox,
  IconX,
  IconPlus,
  IconTrash,
  IconPlayerPlay,
} from '@tabler/icons-react';
import { toast } from 'sonner';

interface CreateContainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (containerId: string) => void;
}

export function CreateContainerModal({ isOpen, onClose, onSuccess }: CreateContainerModalProps) {
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [command, setCommand] = useState('');
  const [restartPolicy, setRestartPolicy] = useState<'no' | 'unless-stopped' | 'always' | 'on-failure'>('unless-stopped');
  const [network, setNetwork] = useState('bridge');
  const [autoStart, setAutoStart] = useState(true);
  const [autoRemove, setAutoRemove] = useState(false);

  // Dynamic lists
  const [ports, setPorts] = useState<{ host_port: string; container_port: string; protocol: 'tcp' | 'udp' }[]>([]);
  const [volumes, setVolumes] = useState<{ source: string; destination: string; mode: 'rw' | 'ro' }[]>([]);
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);

  // Autocomplete data
  const { data: images = [] } = useImages();
  const { data: networks = [] } = useNetworks();
  const { data: volumeList = [] } = useVolumes();

  const createMutation = useCreateContainer();

  if (!isOpen) return null;

  const handleAddPort = () => setPorts([...ports, { host_port: '', container_port: '', protocol: 'tcp' }]);
  const handleRemovePort = (idx: number) => setPorts(ports.filter((_, i) => i !== idx));

  const handleAddVolume = () => setVolumes([...volumes, { source: '', destination: '', mode: 'rw' }]);
  const handleRemoveVolume = (idx: number) => setVolumes(volumes.filter((_, i) => i !== idx));

  const handleAddEnv = () => setEnvVars([...envVars, { key: '', value: '' }]);
  const handleRemoveEnv = (idx: number) => setEnvVars(envVars.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!image.trim()) {
      toast.error('Image name is required');
      return;
    }

    const validPorts = ports
      .filter((p) => p.container_port.trim())
      .map((p) => ({
        host_port: p.host_port.trim(),
        container_port: p.container_port.trim(),
        protocol: p.protocol,
      }));

    const validVolumes = volumes
      .filter((v) => v.source.trim() && v.destination.trim())
      .map((v) => ({
        source: v.source.trim(),
        destination: v.destination.trim(),
        mode: v.mode,
      }));

    const envArray: string[] = [];
    for (const item of envVars) {
      if (item.key.trim()) {
        envArray.push(`${item.key.trim()}=${item.value.trim()}`);
      }
    }

    const cmdArray = command.trim() ? command.trim().split(/\s+/) : undefined;

    try {
      const res = await createMutation.mutateAsync({
        name: name.trim() || undefined,
        image: image.trim(),
        cmd: cmdArray,
        env: envArray.length > 0 ? envArray : undefined,
        ports: validPorts.length > 0 ? validPorts : undefined,
        volumes: validVolumes.length > 0 ? validVolumes : undefined,
        network: network.trim() || 'bridge',
        restart_policy: restartPolicy,
        auto_remove: autoRemove,
        start: autoStart,
      });

      toast.success('Container created successfully!', {
        description: autoStart ? 'Container is now running.' : 'Container created in stopped state.',
      });
      onClose();
      if (onSuccess && res?.id) {
        onSuccess(res.id);
      }
    } catch (err: any) {
      toast.error('Failed to create container', { description: err.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-[#23232A] p-6 shadow-2xl space-y-5 text-zinc-900 dark:text-zinc-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900/40">
              <IconBox className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Run Standalone Container</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Spin up an isolated container with custom ports, volumes, and networking.
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
          {/* Container Name & Image */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Image <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. nginx:alpine, redis:latest"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                className="font-mono text-xs"
                list="local-images-list"
                required
              />
              <datalist id="local-images-list">
                {images.flatMap((img) =>
                  (img.repo_tags || []).filter((t) => t !== '<none>:<none>').map((tag) => (
                    <option key={tag} value={tag} />
                  ))
                )}
              </datalist>
              <span className="text-[11px] text-zinc-500">
                Docker Hub image or select from locally pulled images
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Container Name
              </label>
              <Input
                placeholder="e.g. web-app (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="font-mono text-xs"
              />
              <span className="text-[11px] text-zinc-500">
                Leave empty for Docker auto-generated name
              </span>
            </div>
          </div>

          {/* Command */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Entrypoint Command Override (optional)
            </label>
            <Input
              placeholder="e.g. /bin/sh -c 'npm start'"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          {/* Port Mappings */}
          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-[#1F1F24]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Port Publishing (-p)
                </span>
                <p className="text-[11px] text-zinc-500">Map host traffic to container internal ports.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAddPort} className="gap-1 text-xs">
                <IconPlus className="w-3.5 h-3.5" /> Add Port
              </Button>
            </div>

            {ports.length > 0 && (
              <div className="space-y-2">
                {ports.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder="Host Port (e.g. 8080)"
                      value={p.host_port}
                      onChange={(e) => {
                        const next = [...ports];
                        next[idx].host_port = e.target.value;
                        setPorts(next);
                      }}
                      className="font-mono text-xs flex-1"
                    />
                    <span className="text-xs text-zinc-400">:</span>
                    <Input
                      placeholder="Container Port (e.g. 80)"
                      value={p.container_port}
                      onChange={(e) => {
                        const next = [...ports];
                        next[idx].container_port = e.target.value;
                        setPorts(next);
                      }}
                      className="font-mono text-xs flex-1"
                      required
                    />
                    <select
                      value={p.protocol}
                      onChange={(e) => {
                        const next = [...ports];
                        next[idx].protocol = e.target.value as 'tcp' | 'udp';
                        setPorts(next);
                      }}
                      className="text-xs h-9 px-2 rounded-lg border border-zinc-200 dark:border-[#272730] bg-zinc-50 dark:bg-[#16161C] text-zinc-900 dark:text-zinc-100"
                    >
                      <option value="tcp">TCP</option>
                      <option value="udp">UDP</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleRemovePort(idx)}
                      className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Volume Mounts */}
          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-[#1F1F24]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Storage Volumes (-v)
                </span>
                <p className="text-[11px] text-zinc-500">Attach host paths or named volumes.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAddVolume} className="gap-1 text-xs">
                <IconPlus className="w-3.5 h-3.5" /> Add Mount
              </Button>
            </div>

            {volumes.length > 0 && (
              <div className="space-y-2">
                {volumes.map((v, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder="Source (Volume name or /path)"
                      value={v.source}
                      onChange={(e) => {
                        const next = [...volumes];
                        next[idx].source = e.target.value;
                        setVolumes(next);
                      }}
                      className="font-mono text-xs flex-1"
                      list="volumes-autocomplete-list"
                    />
                    <datalist id="volumes-autocomplete-list">
                      {volumeList.map((vol) => (
                        <option key={vol.name} value={vol.name} />
                      ))}
                    </datalist>
                    <span className="text-xs text-zinc-400">:</span>
                    <Input
                      placeholder="Target (/data or /var/www)"
                      value={v.destination}
                      onChange={(e) => {
                        const next = [...volumes];
                        next[idx].destination = e.target.value;
                        setVolumes(next);
                      }}
                      className="font-mono text-xs flex-1"
                    />
                    <select
                      value={v.mode}
                      onChange={(e) => {
                        const next = [...volumes];
                        next[idx].mode = e.target.value as 'rw' | 'ro';
                        setVolumes(next);
                      }}
                      className="text-xs h-9 px-2 rounded-lg border border-zinc-200 dark:border-[#272730] bg-zinc-50 dark:bg-[#16161C] text-zinc-900 dark:text-zinc-100"
                    >
                      <option value="rw">RW</option>
                      <option value="ro">RO</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleRemoveVolume(idx)}
                      className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Network & Restart Policy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-100 dark:border-[#1F1F24]">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Network Driver
              </label>
              <select
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
                className="w-full text-xs h-9 px-3 rounded-lg border border-zinc-200 dark:border-[#272730] bg-zinc-50 dark:bg-[#16161C] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
              >
                <option value="bridge">bridge (default)</option>
                <option value="host">host (share host stack)</option>
                <option value="none">none (isolated)</option>
                {networks
                  .filter((n) => !['bridge', 'host', 'none'].includes(n.Name))
                  .map((n) => (
                    <option key={n.Id} value={n.Name}>
                      {n.Name} ({n.Driver})
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Restart Policy
              </label>
              <select
                value={restartPolicy}
                onChange={(e) => setRestartPolicy(e.target.value as any)}
                className="w-full text-xs h-9 px-3 rounded-lg border border-zinc-200 dark:border-[#272730] bg-zinc-50 dark:bg-[#16161C] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
              >
                <option value="unless-stopped">Unless Stopped (Recommended)</option>
                <option value="always">Always</option>
                <option value="on-failure">On Failure</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>

          {/* Environment Variables */}
          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-[#1F1F24]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Environment Variables (-e)
                </span>
                <p className="text-[11px] text-zinc-500">Key-value configurations for the container runtime.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAddEnv} className="gap-1 text-xs">
                <IconPlus className="w-3.5 h-3.5" /> Add Env
              </Button>
            </div>

            {envVars.length > 0 && (
              <div className="space-y-2 max-h-36 overflow-y-auto">
                {envVars.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder="KEY (e.g. NODE_ENV)"
                      value={item.key}
                      onChange={(e) => {
                        const next = [...envVars];
                        next[idx].key = e.target.value;
                        setEnvVars(next);
                      }}
                      className="font-mono text-xs flex-1"
                    />
                    <Input
                      placeholder="VALUE (e.g. production)"
                      value={item.value}
                      onChange={(e) => {
                        const next = [...envVars];
                        next[idx].value = e.target.value;
                        setEnvVars(next);
                      }}
                      className="font-mono text-xs flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveEnv(idx)}
                      className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checkboxes: Start immediately & Auto-remove */}
          <div className="flex items-center gap-6 pt-2 border-t border-zinc-100 dark:border-[#1F1F24]">
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoStart}
                onChange={(e) => setAutoStart(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 border-zinc-300 dark:border-zinc-700 focus:ring-purple-500 cursor-pointer"
              />
              <span>Start container automatically</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRemove}
                onChange={(e) => setAutoRemove(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 border-zinc-300 dark:border-zinc-700 focus:ring-purple-500 cursor-pointer"
              />
              <span>Auto-remove on exit (--rm)</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-200 dark:border-[#23232A]">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={createMutation.isPending}
              className="gap-1.5"
            >
              <IconPlayerPlay className="w-4 h-4" />
              <span>{createMutation.isPending ? 'Starting...' : 'Run Container'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

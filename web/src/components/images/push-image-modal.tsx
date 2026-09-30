import { useState, useEffect } from 'react';
import {
  IconUpload,
  IconLoader2,
  IconX,
  IconKey,
  IconChevronDown,
  IconChevronUp,
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
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { useRegistries } from '../../hooks/use-registries';

interface PushImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageId: string;
  availableTags?: string[];
  onSuccess?: () => void;
}

export function PushImageModal({
  isOpen,
  onClose,
  imageId,
  availableTags = [],
  onSuccess,
}: PushImageModalProps) {
  const cleanTags = availableTags.filter((t) => t && t !== '<none>:<none>');
  const [selectedTag, setSelectedTag] = useState(cleanTags[0] || '');
  const [customTag, setCustomTag] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [serverAddress, setServerAddress] = useState('https://index.docker.io/v1/');
  const [isPushing, setIsPushing] = useState(false);
  const [pushLogs, setPushLogs] = useState<string[]>([]);

  const { data: registries = [] } = useRegistries();

  const handleSelectSavedRegistry = (regIdStr: string) => {
    const reg = registries.find((r) => String(r.id) === regIdStr);
    if (reg) {
      setServerAddress(reg.server_address);
      if (reg.username) setUsername(reg.username);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const valid = availableTags.filter((t) => t && t !== '<none>:<none>');
      setSelectedTag(valid[0] || 'custom');
      setPushLogs([]);
      setIsPushing(false);

      const defaultReg = registries.find((r) => r.is_default);
      if (defaultReg) {
        setServerAddress(defaultReg.server_address);
        if (defaultReg.username) setUsername(defaultReg.username);
      }
    }
  }, [isOpen, availableTags, registries]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isPushing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPushing, onClose]);

  if (!isOpen) return null;

  const targetTag = selectedTag === 'custom' ? customTag.trim() : selectedTag.trim();

  const handlePush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTag) {
      toast.error('Please select or specify a target tag to push');
      return;
    }

    setIsPushing(true);
    setPushLogs([`Initiating push for ${targetTag}...`]);

    let authBase64: string | undefined;
    if (username.trim() && password.trim()) {
      const authObj = {
        username: username.trim(),
        password: password.trim(),
        serveraddress: serverAddress.trim() || 'https://index.docker.io/v1/',
      };
      authBase64 = btoa(JSON.stringify(authObj));
    }

    try {
      await api.pushImage(imageId, targetTag, authBase64, (event) => {
        if (event.error) {
          setPushLogs((prev) => [...prev, `[ERROR] ${event.error}`]);
        } else if (event.status) {
          const detail = event.id ? `[${event.id}] ` : '';
          const progress = event.progress ? ` ${event.progress}` : '';
          setPushLogs((prev) => [...prev.slice(-25), `${detail}${event.status}${progress}`]);
        }
      });

      toast.success(`Successfully pushed ${targetTag}`);
      setPushLogs((prev) => [...prev, 'Push complete!']);
      onSuccess?.();
    } catch (err: any) {
      toast.error('Failed to push image', { description: err.message });
      setPushLogs((prev) => [...prev, `[FAILED] ${err.message}`]);
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPushing) onClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-2xl shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-[#202026]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <IconUpload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Push Image to Registry</h2>
              <p className="text-[11px] text-zinc-500">
                Push image layers to Docker Hub, GitHub CR, or private registry
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isPushing}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handlePush} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block mb-1">
              Select Tag to Push <span className="text-red-500">*</span>
            </label>
            {cleanTags.length > 0 ? (
              <Select value={selectedTag} onValueChange={setSelectedTag}>
                <SelectTrigger className="h-9 font-mono text-xs">
                  <SelectValue placeholder="Select a repository tag" />
                </SelectTrigger>
                <SelectContent>
                  {cleanTags.map((t) => (
                    <SelectItem key={t} value={t} className="font-mono text-xs">
                      {t}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom" className="font-mono text-xs">
                    + Custom tag / reference...
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : null}

            {(cleanTags.length === 0 || selectedTag === 'custom') && (
              <div className="mt-2">
                <Input
                  type="text"
                  placeholder="e.g. docker.io/username/repo:tag"
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  className="h-9 font-mono text-xs"
                  autoFocus={cleanTags.length === 0}
                  required
                />
              </div>
            )}
          </div>

          {/* Authentication Section Toggle */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAuth(!showAuth)}
              className="flex items-center justify-between w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <IconKey className="w-3.5 h-3.5 text-zinc-500" />
                <span>Registry Authentication (Optional)</span>
                {username.trim() && (
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.2 rounded font-mono">
                    Configured
                  </span>
                )}
              </div>
              {showAuth ? <IconChevronUp className="w-4 h-4 text-zinc-400" /> : <IconChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>

            {showAuth && (
              <div className="p-3 mt-2 rounded-xl bg-zinc-50/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-3 animate-in fade-in duration-100">
                {registries.length > 0 && (
                  <div>
                    <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                      Choose Saved Registry
                    </label>
                    <Select onValueChange={handleSelectSavedRegistry}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select a configured registry..." />
                      </SelectTrigger>
                      <SelectContent>
                        {registries.map((r) => (
                          <SelectItem key={r.id} value={String(r.id)}>
                            {r.name} ({r.server_address}) {r.is_default ? '★' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                    Registry Server Address
                  </label>
                  <Input
                    type="text"
                    placeholder="https://index.docker.io/v1/ or ghcr.io"
                    value={serverAddress}
                    onChange={(e) => setServerAddress(e.target.value)}
                    className="h-8 font-mono text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                      Username
                    </label>
                    <Input
                      type="text"
                      placeholder="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                      Password or Token
                    </label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Live Progress Logs */}
          {pushLogs.length > 0 && (
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 space-y-1 max-h-36 overflow-y-auto font-mono text-[11px] text-zinc-300">
              <div className="text-[10px] uppercase font-semibold text-zinc-500 mb-1">
                Push Output Stream
              </div>
              {pushLogs.map((log, i) => (
                <div key={i} className="truncate leading-tight">
                  {log}
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-[#202026]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isPushing}
            >
              {pushLogs.length > 0 && !isPushing ? 'Close' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPushing || !targetTag}
              className="bg-blue-600 hover:bg-blue-500 text-white gap-1.5"
            >
              {isPushing ? (
                <>
                  <IconLoader2 className="w-3.5 h-3.5 animate-spin" />
                  Pushing Layers...
                </>
              ) : (
                <>
                  <IconUpload className="w-3.5 h-3.5" />
                  Start Push
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

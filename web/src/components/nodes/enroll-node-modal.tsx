import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import {
  IconServer,
  IconX,
  IconCopy,
  IconCheck,
  IconBrandDocker,
  IconTerminal2,
  IconSettings,
  IconRefresh,
  IconLoader2,
} from '@tabler/icons-react';
import { toast } from 'sonner';

interface EnrollNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EnrollNodeModal({ isOpen, onClose, onSuccess }: EnrollNodeModalProps) {
  const [activeTab, setActiveTab] = useState<'docker' | 'shell' | 'manual'>('docker');
  const [loading, setLoading] = useState(false);
  const [enrollmentData, setEnrollmentData] = useState<{
    token: string;
    server_url: string;
    docker_command: string;
    install_command: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const fetchEnrollment = async () => {
    setLoading(true);
    try {
      const data = await api.getNodeEnrollment();
      setEnrollmentData(data);
    } catch (err: any) {
      toast.error('Failed to generate enrollment token: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEnrollment();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Command copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-[#23232A] p-6 shadow-2xl space-y-5 text-zinc-900 dark:text-zinc-100 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <IconServer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Enroll Remote Docker Node
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Connect external VPS or on-premises servers via outbound WebSocket tunnel.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#1A1A22] transition-colors"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Security Alert Note */}
        <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300 space-y-1">
          <span className="font-semibold block">Zero Inbound Ports Required</span>
          <p className="text-[11px] text-blue-700 dark:text-blue-400">
            The lightweight <code>dockor-agent</code> dials OUTBOUND to your Dockor control plane. You do not need to open public Docker sockets or configure port forwarding on the remote server.
          </p>
        </div>

        {/* Mode Tabs */}
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} variant="line" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="docker" className="gap-1.5">
              <IconBrandDocker className="w-4 h-4" />
              <span>Docker Container (Recommended)</span>
            </TabsTrigger>

            <TabsTrigger value="shell" className="gap-1.5">
              <IconTerminal2 className="w-4 h-4" />
              <span>Linux Shell Script</span>
            </TabsTrigger>

            <TabsTrigger value="manual" className="gap-1.5">
              <IconSettings className="w-4 h-4" />
              <span>Manual Config</span>
            </TabsTrigger>
          </TabsList>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-zinc-500">
              <IconLoader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span>Generating secure enrollment token...</span>
            </div>
          ) : enrollmentData ? (
            <div className="space-y-4">
              <TabsContent value="docker" className="mt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                      Run on Remote Server:
                    </span>
                    <Button
                      size="xs"
                      variant="surface"
                      onClick={() => handleCopy(enrollmentData.docker_command, 'docker')}
                      className="gap-1 text-[11px] h-7"
                    >
                      {copiedKey === 'docker' ? (
                        <IconCheck className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <IconCopy className="w-3.5 h-3.5" />
                      )}
                      <span>Copy Command</span>
                    </Button>
                  </div>

                  <pre className="p-3.5 bg-zinc-950 text-zinc-200 font-mono text-[11px] rounded-xl border border-zinc-800 overflow-x-auto select-all leading-relaxed whitespace-pre-wrap">
                    {enrollmentData.docker_command}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="shell" className="mt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                      Install & Run via Shell Script:
                    </span>
                    <Button
                      size="xs"
                      variant="surface"
                      onClick={() => handleCopy(enrollmentData.install_command, 'shell')}
                      className="gap-1 text-[11px] h-7"
                    >
                      {copiedKey === 'shell' ? (
                        <IconCheck className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <IconCopy className="w-3.5 h-3.5" />
                      )}
                      <span>Copy Script</span>
                    </Button>
                  </div>

                  <pre className="p-3.5 bg-zinc-950 text-zinc-200 font-mono text-[11px] rounded-xl border border-zinc-800 overflow-x-auto select-all leading-relaxed whitespace-pre-wrap">
                    {enrollmentData.install_command}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="manual" className="mt-4">
                <div className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <span className="text-zinc-500 font-medium">Control Plane WebSocket URL</span>
                    <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-[#0A0A0E] border border-zinc-200 dark:border-[#22222A] font-mono text-[11px] select-all">
                      {enrollmentData.server_url}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-zinc-500 font-medium">Node Enrollment Pairing Key</span>
                    <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-[#0A0A0E] border border-zinc-200 dark:border-[#22222A] font-mono text-[11px] select-all">
                      {enrollmentData.token}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-[#1E1E24]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchEnrollment}
                  className="gap-1.5 text-xs text-zinc-500"
                >
                  <IconRefresh className="w-3.5 h-3.5" />
                  <span>Refresh Key</span>
                </Button>

                <Button
                  size="sm"
                  variant="surface"
                  onClick={() => {
                    onSuccess?.();
                    onClose();
                  }}
                  className="text-xs"
                >
                  Done
                </Button>
              </div>
            </div>
          ) : null}
        </Tabs>
      </div>
    </div>
  );
}

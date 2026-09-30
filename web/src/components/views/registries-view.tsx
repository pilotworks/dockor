import { useState, useMemo } from 'react';
import {
  IconDatabase,
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconLock,
  IconCheck,
  IconRefresh,
  IconServer,
  IconShieldLock,
  IconExternalLink,
} from '@tabler/icons-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { useRegistries, useDeleteRegistry } from '../../hooks/use-registries';
import { CreateRegistryModal } from '../registries/create-registry-modal';
import { confirmDialog } from '../../stores/use-dialog-store';
import { Registry } from '../../types';

export function RegistriesView() {
  const { data: registries = [], isLoading, refetch } = useRegistries();
  const deleteMutation = useDeleteRegistry();

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [registryToEdit, setRegistryToEdit] = useState<Registry | null>(null);

  const filteredRegistries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return registries;
    return registries.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.server_address.toLowerCase().includes(q) ||
        (r.username && r.username.toLowerCase().includes(q))
    );
  }, [registries, searchQuery]);

  const handleEdit = (registry: Registry) => {
    setRegistryToEdit(registry);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setRegistryToEdit(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (registry: Registry) => {
    const confirmed = await confirmDialog({
      title: 'Delete Registry',
      description: `Are you sure you want to remove registry "${registry.name}" (${registry.server_address})? Any credentials saved for this registry will be permanently deleted.`,
      confirmText: 'Delete',
      variant: 'destructive',
    });

    if (confirmed) {
      try {
        await deleteMutation.mutateAsync(registry.id);
        toast.success(`Registry "${registry.name}" deleted successfully`);
      } catch (err: any) {
        toast.error('Failed to delete registry', { description: err.message });
      }
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Container Registries
            </h1>
            <Badge variant="neutral" className="text-xs font-mono font-normal">
              {registries.length} configured
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Manage authenticated container registries (Docker Hub, GHCR, GitLab, private Harbor) with hardware-grade AES-256-GCM encrypted credentials.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="surface" size="sm" onClick={() => refetch()} className="gap-1.5 text-xs">
            <IconRefresh className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={handleCreate} className="gap-1.5 text-xs">
            <IconPlus className="w-3.5 h-3.5" />
            Add Registry
          </Button>
        </div>
      </div>

      {/* Security Banner */}
      <div className="rounded-xl p-3.5 bg-gradient-to-r from-blue-500/10 via-emerald-500/5 to-transparent border border-blue-200/60 dark:border-blue-900/30 flex items-start gap-3">
        <IconShieldLock className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-0.5">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">
            Secure Credential Storage Policy
          </p>
          <p className="text-zinc-600 dark:text-zinc-400">
            Passwords and personal access tokens are never stored in plaintext. They are encrypted using <strong>AES-256-GCM</strong> with an isolated master key stored separately in <code className="font-mono text-[11px] bg-zinc-200/60 dark:bg-zinc-800 px-1 py-0.5 rounded">dockor.secret.key</code>.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <IconSearch className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search by name, server or user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Registries Table / List */}
      <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-zinc-500">Loading registries...</div>
        ) : filteredRegistries.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
              <IconServer className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {searchQuery ? 'No registries match your search' : 'No container registries configured'}
              </p>
              <p className="text-xs text-zinc-500 max-w-md mx-auto mt-1">
                Add Docker Hub, GitHub Packages, or your private container registry to pull private images and push custom container builds.
              </p>
            </div>
            {!searchQuery && (
              <Button variant="primary" size="sm" onClick={handleCreate} className="gap-1.5 text-xs mt-2">
                <IconPlus className="w-3.5 h-3.5" />
                Add Your First Registry
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-[#202026] bg-zinc-50/75 dark:bg-[#0E0E12] text-zinc-500 dark:text-zinc-400 font-mono uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Registry Name</th>
                  <th className="py-3 px-4">Server Address</th>
                  <th className="py-3 px-4">Account / Username</th>
                  <th className="py-3 px-4">Encryption</th>
                  <th className="py-3 px-4">Default</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-[#202026]">
                {filteredRegistries.map((reg) => (
                  <tr
                    key={reg.id}
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                      <div className="flex items-center gap-2">
                        <IconDatabase className="w-4 h-4 text-blue-500 shrink-0" />
                        <span>{reg.name}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-zinc-600 dark:text-zinc-300">
                      <div className="flex items-center gap-1.5">
                        <span>{reg.server_address}</span>
                        {reg.server_address.startsWith('http') && (
                          <a
                            href={reg.server_address}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                          >
                            <IconExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-zinc-700 dark:text-zinc-300 font-mono">
                      {reg.username ? reg.username : <span className="text-zinc-400 italic">None</span>}
                    </td>

                    <td className="py-3.5 px-4">
                      {reg.has_password ? (
                        <div className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                          <IconLock className="w-3 h-3" />
                          <span>AES-256</span>
                        </div>
                      ) : (
                        <span className="text-zinc-400 text-[11px]">Unauthenticated</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {reg.is_default ? (
                        <Badge variant="success" className="gap-1 text-[10px] uppercase font-bold tracking-wider">
                          <IconCheck className="w-2.5 h-2.5 stroke-[3]" />
                          Default
                        </Badge>
                      ) : (
                        <span className="text-zinc-400 text-xs">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="surface"
                          size="sm"
                          onClick={() => handleEdit(reg)}
                          className="h-7 px-2 text-xs gap-1"
                          title="Edit registry"
                        >
                          <IconEdit className="w-3.5 h-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="surface"
                          size="sm"
                          onClick={() => handleDelete(reg)}
                          className="h-7 px-2 text-xs gap-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                          title="Delete registry"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal for Creating / Editing */}
      <CreateRegistryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        registryToEdit={registryToEdit}
      />
    </div>
  );
}

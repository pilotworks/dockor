import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { User, UserRole } from '../../types';
import { useAuthStore } from '../../stores/use-auth-store';
import { confirmDialog } from '../../stores/use-dialog-store';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/table';
import { CreateUserModal } from '../users/create-user-modal';
import { EditUserModal } from '../users/edit-user-modal';
import {
  IconUsers,
  IconPlus,
  IconShieldCheck,
  IconCode,
  IconEye,
  IconPencil,
  IconTrash,
  IconMail,
  IconCalendar,
  IconRefresh,
} from '@tabler/icons-react';
import { toast } from 'sonner';

export function UsersView() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const { data: users, isLoading, error, refetch } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.getUsers(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User account deleted');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete user');
    },
  });

  const handleDeleteUser = async (user: User) => {
    if (user.id === currentUser?.id) {
      toast.error('You cannot delete your own account');
      return;
    }

    const confirmed = await confirmDialog({
      title: `Delete user "${user.username}"?`,
      description: `Are you sure you want to permanently remove operator account "${user.username}" (${user.email})? This action cannot be undone.`,
      confirmText: 'Delete User',
      variant: 'destructive',
    });

    if (confirmed) {
      deleteMutation.mutate(user.id);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-400 gap-1 font-medium">
            <IconShieldCheck className="w-3.5 h-3.5" />
            Admin
          </Badge>
        );
      case 'developer':
        return (
          <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-400 gap-1 font-medium">
            <IconCode className="w-3.5 h-3.5" />
            Developer
          </Badge>
        );
      case 'viewer':
        return (
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400 gap-1 font-medium">
            <IconEye className="w-3.5 h-3.5" />
            Viewer
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <IconUsers className="w-6 h-6 text-primary" />
            Users &amp; Access Control
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage operator accounts, assign RBAC roles, and control access permissions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-9 gap-1.5"
          >
            <IconRefresh className="w-4 h-4" />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="h-9 gap-1.5 shadow-sm"
          >
            <IconPlus className="w-4 h-4" />
            Add User
          </Button>
        </div>
      </div>

      {/* Role explanation cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500 dark:text-indigo-400">
            <IconShieldCheck className="w-4 h-4" />
            Admin Role
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Full root privileges: manages users, cluster nodes, encrypted registries, and system prune.
          </p>
        </div>
        <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-500 dark:text-blue-400">
            <IconCode className="w-4 h-4" />
            Developer Role
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Operational access: deploy stacks, execute container exec shell, write files, manage images and volumes.
          </p>
        </div>
        <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-500 dark:text-amber-400">
            <IconEye className="w-4 h-4" />
            Viewer Role
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Read-only access: view dashboard, inspect container logs, stats, read files without modification permissions.
          </p>
        </div>
      </div>

      {/* Users Table */}
      <Card className="border border-zinc-200 dark:border-[#23232A] overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Loading users...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-600 dark:text-red-400 font-medium">
            {(error as any)?.message || 'Failed to load users'}
          </div>
        ) : !users || users.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 mx-auto flex items-center justify-center text-zinc-400 dark:text-zinc-500">
              <IconUsers className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No users registered</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operator</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                const formattedDate = new Date(u.created_at).toLocaleDateString([], {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                });

                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-center font-semibold text-xs text-blue-600 dark:text-blue-400 shrink-0">
                          {u.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                            {u.username}
                            {isSelf && (
                              <Badge variant="neutral" className="text-[10px] py-0 px-1.5 h-4">
                                You
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                            {u.id}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      {getRoleBadge(u.role)}
                    </TableCell>

                    <TableCell className="text-zinc-600 dark:text-zinc-300">
                      <div className="flex items-center gap-1.5">
                        <IconMail className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{u.email}</span>
                      </div>
                    </TableCell>

                    <TableCell className="text-zinc-500 dark:text-zinc-400 text-xs">
                      <div className="flex items-center gap-1.5">
                        <IconCalendar className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{formattedDate}</span>
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingUser(u)}
                          className="h-8 px-2 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                        >
                          <IconPencil className="w-3.5 h-3.5 mr-1" />
                          Edit
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isSelf}
                          onClick={() => handleDeleteUser(u)}
                          className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-30"
                          title={isSelf ? 'Cannot delete your own account' : 'Delete user'}
                        >
                          <IconTrash className="w-3.5 h-3.5 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Modals */}
      <CreateUserModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
      />

      <EditUserModal
        user={editingUser}
        isOpen={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
      />
    </div>
  );
}
export default UsersView;

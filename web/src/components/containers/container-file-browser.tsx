import { useState, useEffect, useRef } from 'react';
import {
  IconFolder,
  IconFile,
  IconFileText,
  IconFileCode,
  IconArchive,
  IconDownload,
  IconTrash,
  IconUpload,
  IconRefresh,
  IconChevronRight,
  IconHome,
  IconEdit,
  IconLoader2,
  IconDeviceFloppy,
  IconCornerLeftUp,
} from '@tabler/icons-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/table';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { confirmDialog } from '../../stores/use-dialog-store';
import { FileItem } from '../../types';
import Editor from '@monaco-editor/react';
import { useAppStore } from '../../stores/use-app-store';

interface ContainerFileBrowserProps {
  containerId: string;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(item: FileItem) {
  if (item.is_dir) {
    return <IconFolder className="w-4 h-4 text-amber-500 fill-amber-500/20 shrink-0" />;
  }
  const ext = item.name.split('.').pop()?.toLowerCase();
  if (['json', 'yaml', 'yml', 'conf', 'ini', 'env', 'xml', 'toml'].includes(ext || '')) {
    return <IconFileText className="w-4 h-4 text-blue-500 shrink-0" />;
  }
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'go', 'sh', 'bash', 'rb', 'php', 'html', 'css'].includes(ext || '')) {
    return <IconFileCode className="w-4 h-4 text-purple-500 shrink-0" />;
  }
  if (['tar', 'gz', 'zip', 'tgz', 'rar', '7z', 'bz2'].includes(ext || '')) {
    return <IconArchive className="w-4 h-4 text-rose-500 shrink-0" />;
  }
  return <IconFile className="w-4 h-4 text-zinc-400 shrink-0" />;
}

export function ContainerFileBrowser({ containerId }: ContainerFileBrowserProps) {
  const { theme } = useAppStore();
  const [currentPath, setCurrentPath] = useState('/');
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editor modal state
  const [editingFile, setEditingFile] = useState<{ path: string; name: string; content: string } | null>(null);
  const [savingFile, setSavingFile] = useState(false);

  const fetchFiles = async (dirPath: string) => {
    setLoading(true);
    try {
      const res = await api.getContainerFiles(containerId, dirPath);
      setItems(res.items || []);
      setCurrentPath(res.path || dirPath);
    } catch (err: any) {
      toast.error('Failed to list files', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles(currentPath);
  }, [containerId]);

  const handleNavigate = (targetPath: string) => {
    fetchFiles(targetPath);
  };

  const handleParentDirectory = () => {
    if (currentPath === '/' || !currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const parent = '/' + parts.join('/');
    fetchFiles(parent);
  };

  const handleOpenFile = async (item: FileItem) => {
    if (item.is_dir) {
      handleNavigate(item.path);
      return;
    }

    try {
      const res = await api.readContainerFile(containerId, item.path);
      setEditingFile({
        path: item.path,
        name: item.name,
        content: res.content,
      });
    } catch (err: any) {
      toast.error('Failed to read file', { description: err.message });
    }
  };

  const handleSaveFile = async () => {
    if (!editingFile) return;
    setSavingFile(true);
    try {
      await api.writeContainerFile(containerId, editingFile.path, editingFile.content);
      toast.success(`File ${editingFile.name} saved successfully`);
      setEditingFile(null);
      fetchFiles(currentPath);
    } catch (err: any) {
      toast.error('Failed to save file', { description: err.message });
    } finally {
      setSavingFile(false);
    }
  };

  const handleDeleteItem = async (item: FileItem) => {
    const confirmed = await confirmDialog({
      title: item.is_dir ? 'Delete Directory' : 'Delete File',
      description: `Are you sure you want to permanently delete "${item.name}" from the container?`,
      confirmText: 'Delete',
      variant: 'destructive',
    });
    if (!confirmed) return;

    try {
      await api.deleteContainerPath(containerId, item.path);
      toast.success(`Deleted ${item.name}`);
      fetchFiles(currentPath);
    } catch (err: any) {
      toast.error('Failed to delete', { description: err.message });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading(`Uploading ${file.name}...`);
    try {
      await api.uploadContainerFile(containerId, currentPath, file);
      toast.success(`Uploaded ${file.name} successfully`, { id: toastId });
      fetchFiles(currentPath);
    } catch (err: any) {
      toast.error(`Upload failed`, { description: err.message, id: toastId });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const pathSegments = currentPath.split('/').filter(Boolean);

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Top Bar with Breadcrumbs & Shortcuts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-xl shadow-xs">
        {/* Breadcrumb Path */}
        <div className="flex items-center gap-1 text-xs font-mono overflow-x-auto py-1">
          <button
            type="button"
            onClick={() => handleNavigate('/')}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold"
          >
            <IconHome className="w-3.5 h-3.5" />
            <span>/</span>
          </button>
          {pathSegments.map((segment, idx) => {
            const subPath = '/' + pathSegments.slice(0, idx + 1).join('/');
            const isLast = idx === pathSegments.length - 1;
            return (
              <div key={idx} className="flex items-center gap-1">
                <IconChevronRight className="w-3 h-3 text-zinc-400 shrink-0" />
                <button
                  type="button"
                  onClick={() => handleNavigate(subPath)}
                  className={`px-1.5 py-0.5 rounded text-xs truncate max-w-[150px] ${
                    isLast
                      ? 'font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40'
                      : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {segment}
                </button>
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <Input
            type="text"
            placeholder="Filter files..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="h-8 text-xs font-mono w-36 sm:w-44"
          />

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />

          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="h-8 text-xs gap-1.5"
            title="Upload file into current directory"
          >
            <IconUpload className="w-3.5 h-3.5 text-zinc-500" />
            <span className="hidden sm:inline">Upload</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchFiles(currentPath)}
            disabled={loading}
            className="h-8 w-8 p-0"
            title="Refresh directory"
          >
            <IconRefresh className={`w-3.5 h-3.5 text-zinc-500 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Directory Table */}
      <div className="border border-zinc-200 dark:border-[#23232A] rounded-xl overflow-hidden bg-white dark:bg-[#121216] shadow-xs">
        <Table className="font-mono">
          <TableHeader className="bg-zinc-50 dark:bg-[#15151A] border-b border-zinc-200 dark:border-[#23232A] text-zinc-500 dark:text-zinc-400 font-sans text-[11px]">
            <TableRow>
              <TableHead className="py-2.5 px-4 font-semibold text-zinc-500 dark:text-zinc-400">Name</TableHead>
              <TableHead className="py-2.5 px-3 font-semibold w-24 text-zinc-500 dark:text-zinc-400">Size</TableHead>
              <TableHead className="py-2.5 px-3 font-semibold w-28 text-zinc-500 dark:text-zinc-400">Permissions</TableHead>
              <TableHead className="py-2.5 px-3 font-semibold w-36 text-zinc-500 dark:text-zinc-400">Modified</TableHead>
              <TableHead className="py-2.5 px-4 font-semibold text-right w-28 font-sans text-zinc-500 dark:text-zinc-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-zinc-100 dark:divide-[#1C1C22]">
            {/* Parent Directory Link */}
            {currentPath !== '/' && (
              <TableRow
                onClick={handleParentDirectory}
                className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer select-none transition-colors group"
              >
                <TableCell colSpan={5} className="py-2 px-4 text-zinc-500 flex items-center gap-2">
                  <IconCornerLeftUp className="w-4 h-4 text-zinc-400 group-hover:text-blue-500" />
                  <span className="font-semibold text-xs">.. (Parent Directory)</span>
                </TableCell>
              </TableRow>
            )}

            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-16 text-center">
                  <IconLoader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto mb-2" />
                  <span className="text-zinc-400 font-sans text-xs">Reading container filesystem...</span>
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-zinc-400 font-sans text-xs">
                  {filterQuery ? 'No matching files or directories' : 'This directory is empty'}
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow
                  key={item.path}
                  className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition-colors group cursor-pointer"
                  onClick={() => handleOpenFile(item)}
                >
                  <TableCell className="py-2.5 px-4">
                    <div className="flex items-center gap-2.5">
                      {getFileIcon(item)}
                      <span
                        className={`font-mono text-xs ${
                          item.is_dir
                            ? 'font-bold text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400'
                            : 'text-zinc-800 dark:text-zinc-200'
                        }`}
                      >
                        {item.name}
                      </span>
                      {item.is_symlink && (
                        <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono text-zinc-400">
                          symlink {item.link_target ? `→ ${item.link_target}` : ''}
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="py-2.5 px-3 text-zinc-500 dark:text-zinc-400 text-xs">
                    {item.is_dir ? '--' : formatBytes(item.size)}
                  </TableCell>

                  <TableCell className="py-2.5 px-3 text-zinc-400 font-mono text-[11px]">
                    {item.mode || '--'}
                  </TableCell>

                  <TableCell className="py-2.5 px-3 text-zinc-500 dark:text-zinc-400 text-[11px] truncate max-w-[140px]">
                    {item.mod_time ? new Date(item.mod_time).toLocaleDateString() : '--'}
                  </TableCell>

                  <TableCell className="py-2.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {!item.is_dir && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenFile(item)}
                            className="p-1 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            title="View / Edit file"
                          >
                            <IconEdit className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={api.getContainerFileDownloadUrl(containerId, item.path)}
                            download={item.name}
                            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            title="Download file"
                          >
                            <IconDownload className="w-3.5 h-3.5" />
                          </a>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item)}
                        className="p-1 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title="Delete"
                      >
                        <IconTrash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Embedded File Editor Modal */}
      {editingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-4xl bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 dark:border-[#202026] bg-zinc-50 dark:bg-[#0E0E12] shrink-0">
              <div className="flex items-center gap-2.5">
                <IconFileText className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                  {editingFile.name}
                </span>
                <span className="text-[11px] text-zinc-400 font-mono hidden sm:inline">
                  ({editingFile.path})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingFile(null)}
                  className="h-8 text-xs"
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveFile}
                  disabled={savingFile}
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white gap-1.5"
                >
                  {savingFile ? (
                    <IconLoader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <IconDeviceFloppy className="w-3.5 h-3.5" />
                  )}
                  Save Changes
                </Button>
              </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 w-full overflow-hidden">
              <Editor
                height="100%"
                value={editingFile.content}
                onChange={(val) =>
                  setEditingFile((prev) => (prev ? { ...prev, content: val || '' } : null))
                }
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  automaticLayout: true,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

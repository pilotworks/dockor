import { useState, useEffect, useDeferredValue } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTemplates } from '../../hooks/use-templates';
import { TemplateCard } from '../templates/template-card';
import {
  IconSearch,
  IconTemplate,
  IconDownload,
  IconPlus,
  IconRefresh,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from '@tabler/icons-react';
import { cn } from '../../lib/utils';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { ImportCatalogModal } from '../templates/import-catalog-modal';
import { CreateTemplateModal } from '../templates/create-template-modal';

function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total];
  }
  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, '...', current - 1, current, current + 1, '...', total];
}

export function TemplatesView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const catParam = searchParams.get('category') || 'All';
  const searchParam = searchParams.get('search') || '';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const currentPage = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const pageSize = 24;

  const [searchInput, setSearchInput] = useState(searchParam);
  const deferredSearch = useDeferredValue(searchInput);

  // Sync deferred search input to URL query params
  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (deferredSearch.trim()) {
          next.set('search', deferredSearch.trim());
        } else {
          next.delete('search');
        }
        next.delete('page'); // Reset to page 1 on search change
        return next;
      },
      { replace: true }
    );
  }, [deferredSearch, setSearchParams]);

  // Server-side paginated & filtered query
  const { data: templateData, isLoading, error, refetch, isFetching } = useTemplates({
    page: currentPage,
    limit: pageSize,
    category: catParam !== 'All' ? catParam : undefined,
    search: searchParam || undefined,
  });

  const templates = templateData?.items || [];
  const totalItems = templateData?.total || 0;
  const totalPages = templateData?.total_pages || 1;
  const categories = templateData?.categories || [{ name: 'All', count: totalItems }];

  const handleSelectCategory = (cat: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (cat === 'All') {
          next.delete('category');
        } else {
          next.set('category', cat);
        }
        next.delete('page'); // Reset to page 1
        return next;
      },
      { replace: true }
    );
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newPage === 1) {
        next.delete('page');
      } else {
        next.set('page', String(newPage));
      }
      return next;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fromIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const toIndex = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="space-y-6">
      {/* Marketplace Banner / Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-50/80 via-white to-white dark:from-blue-950/40 dark:via-[#121218] dark:to-[#121218] border border-zinc-200 dark:border-[#23232A] p-6 shadow-sm transition-colors">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800/40 text-[11px] font-medium text-blue-700 dark:text-blue-400">
              <IconTemplate className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Official & Community Catalogs</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Application Template Catalog
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xl leading-relaxed">
              Launch pre-configured, multi-container production environments with automated secret generation,
              volume mounts, and dynamic port collision resolution.
            </p>
          </div>

          {/* Actions & Search */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <IconSearch className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 z-10 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search templates or tags..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 pr-4 h-9 rounded-xl"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportOpen(true)}
              className="h-9 px-3 gap-1.5 rounded-xl text-xs"
            >
              <IconDownload className="w-3.5 h-3.5 text-zinc-500" />
              <span>Import Catalog</span>
            </Button>

            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="h-9 px-3 gap-1.5 rounded-xl text-xs bg-blue-600 hover:bg-blue-500 text-white"
            >
              <IconPlus className="w-3.5 h-3.5" />
              <span>New Template</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 w-9 p-0 rounded-xl"
              title="Refresh templates"
            >
              <IconRefresh className={cn('w-3.5 h-3.5 text-zinc-500', isFetching && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </div>

      {/* Category Pills Tab Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-zinc-200 dark:border-[#1F1F24] transition-colors">
        {categories.map((cat) => {
          const isActive = catParam === cat.name;

          return (
            <button
              key={cat.name}
              onClick={() => handleSelectCategory(cat.name)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border cursor-pointer',
                isActive
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border-zinc-300 dark:border-zinc-700 shadow-xs font-semibold'
                  : 'bg-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
              )}
            >
              <span>{cat.name}</span>
              <span
                className={cn(
                  'text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors',
                  isActive
                    ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-600/50'
                    : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400'
                )}
              >
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="py-20 text-center text-xs text-zinc-500">
          Loading catalog manifests...
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-xs text-red-700 dark:text-red-300">
          Failed to load templates: {(error as Error).message}
        </div>
      )}

      {/* Grid of Templates */}
      {!isLoading && !error && templates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <TemplateCard key={t.metadata.id} template={t} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && templates.length === 0 && (
        <div className="border border-dashed border-zinc-300 dark:border-[#272730] rounded-2xl p-16 text-center bg-white dark:bg-[#0D0D10]/50 transition-colors">
          <IconTemplate className="w-10 h-10 text-zinc-400 dark:text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-300">No matching templates found</h3>
          <p className="text-xs text-zinc-500 mt-1">
            Try adjusting your search keywords or switching category filters.
          </p>
        </div>
      )}

      {/* Server-side Pagination Controls */}
      {!isLoading && !error && totalItems > 0 && (
        <div className="pt-4 border-t border-zinc-200 dark:border-[#1F1F24] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <div>
            Showing <span className="font-semibold text-zinc-800 dark:text-zinc-200">{fromIndex}</span> to{' '}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{toIndex}</span> of{' '}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{totalItems}</span> templates
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(1)}
                disabled={currentPage <= 1 || isFetching}
                className="h-8 w-8 p-0 rounded-lg"
                title="First page"
              >
                <IconChevronsLeft className="w-3.5 h-3.5" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1 || isFetching}
                className="h-8 w-8 p-0 rounded-lg"
                title="Previous page"
              >
                <IconChevronLeft className="w-3.5 h-3.5" />
              </Button>

              <div className="flex items-center gap-1 mx-1">
                {getPageNumbers(currentPage, totalPages).map((p, idx) => {
                  if (typeof p === 'string') {
                    return (
                      <span key={`dots-${idx}`} className="px-1 text-zinc-400">
                        ...
                      </span>
                    );
                  }

                  const isActive = p === currentPage;
                  return (
                    <Button
                      key={p}
                      variant={isActive ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => handlePageChange(p as number)}
                      disabled={isFetching}
                      className={cn(
                        'h-8 min-w-[32px] px-2 rounded-lg text-xs font-mono',
                        isActive
                          ? 'bg-blue-600 hover:bg-blue-500 text-white font-semibold'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      )}
                    >
                      {p}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages || isFetching}
                className="h-8 w-8 p-0 rounded-lg"
                title="Next page"
              >
                <IconChevronRight className="w-3.5 h-3.5" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage >= totalPages || isFetching}
                className="h-8 w-8 p-0 rounded-lg"
                title="Last page"
              >
                <IconChevronsRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <ImportCatalogModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => refetch()}
      />
      <CreateTemplateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => refetch()}
      />
    </div>
  );
}

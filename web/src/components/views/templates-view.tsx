import { useTemplates } from '../../hooks/use-templates';
import { useTemplateStore } from '../../stores/use-template-store';
import { TemplateCard } from '../templates/template-card';
import { IconSearch, IconTemplate, IconSparkles } from '@tabler/icons-react';
import { cn } from '../../lib/utils';
import { Input } from '../ui/input';

export function TemplatesView() {
  const { data: templates = [], isLoading, error } = useTemplates();
  const { searchQuery, setSearchQuery, selectedCategory, setSelectedCategory } = useTemplateStore();

  const categories = ['All', ...new Set(templates.map((t) => t.metadata.category).filter(Boolean))];

  const filtered = templates.filter((t) => {
    const matchesQuery =
      t.metadata.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.metadata.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.metadata.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = selectedCategory === 'All' || t.metadata.category === selectedCategory;
    return matchesQuery && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* Marketplace Banner / Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-50/80 via-white to-white dark:from-blue-950/40 dark:via-[#121218] dark:to-[#121218] border border-zinc-200 dark:border-[#23232A] p-6 shadow-sm transition-colors">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800/40 text-[11px] font-medium text-blue-700 dark:text-blue-400">
              <IconSparkles className="w-3 h-3 text-blue-600 dark:text-blue-400" />
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

          {/* Quick Search */}
          <div className="relative w-full md:w-72 shrink-0">
            <IconSearch className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 z-10 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search templates or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 h-9 rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Category Pills Tab Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-zinc-200 dark:border-[#1F1F24] transition-colors">
        {categories.map((cat) => {
          const count =
            cat === 'All'
              ? templates.length
              : templates.filter((t) => t.metadata.category === cat).length;
          const isActive = selectedCategory === cat;

          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border',
                isActive
                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white dark:border-zinc-700'
                  : 'bg-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border-transparent hover:bg-zinc-200/60 dark:hover:bg-zinc-900/60'
              )}
            >
              <span>{cat}</span>
              <span
                className={cn(
                  'text-[10px] font-mono px-1.5 py-0.2 rounded',
                  isActive
                    ? 'bg-zinc-700 text-white dark:bg-zinc-700 dark:text-zinc-200'
                    : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'
                )}
              >
                {count}
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
      {!isLoading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <TemplateCard key={t.metadata.id} template={t} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filtered.length === 0 && (
        <div className="border border-dashed border-zinc-300 dark:border-[#272730] rounded-2xl p-16 text-center bg-white dark:bg-[#0D0D10]/50 transition-colors">
          <IconTemplate className="w-10 h-10 text-zinc-400 dark:text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-300">No matching templates found</h3>
          <p className="text-xs text-zinc-500 mt-1">
            Try adjusting your search keywords or switching category filters.
          </p>
        </div>
      )}
    </div>
  );
}

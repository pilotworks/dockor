import { Template } from '../../types';
import {
  IconPlayerPlay,
  IconExternalLink,
  IconWorld,
  IconDatabase,
  IconNetwork,
  IconShieldLock,
} from '@tabler/icons-react';
import { useTemplateStore } from '../../stores/use-template-store';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface TemplateCardProps {
  template: Template;
}

export function TemplateCard({ template }: TemplateCardProps) {
  const { metadata, variables } = template;
  const openDeployModal = useTemplateStore((s) => s.openDeployModal);

  const defaultPort = variables?.find((v) => v.type === 'port')?.default;
  const hasSecrets = variables?.some((v) => v.type === 'secret');

  return (
    <Card className="flex flex-col justify-between hover:border-blue-500/40 dark:hover:border-zinc-700 group shadow-sm hover:shadow-md transition-all duration-200 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#222228]">
      <div className="p-5">
        {/* Header with App Icon and Badges */}
        <div className="flex items-start justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-[#23232A] flex items-center justify-center p-2 overflow-hidden shrink-0 group-hover:border-blue-400 dark:group-hover:border-zinc-700 transition-colors shadow-inner">
              {metadata.icon ? (
                <img
                  src={metadata.icon}
                  alt={metadata.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{metadata.name.charAt(0)}</span>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors tracking-tight">
                {metadata.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">v{metadata.version}</span>
                <span className="text-zinc-300 dark:text-zinc-600">•</span>
                <Badge variant="neutral" className="text-[10px] py-0 px-1.5">
                  {metadata.category}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-4 leading-relaxed min-h-[32px]">
          {metadata.description}
        </p>

        {/* Feature Pills */}
        <div className="flex items-center gap-2 pt-1 border-t border-zinc-100 dark:border-[#1C1C22] text-[11px]">
          {defaultPort && (
            <span className="flex items-center gap-1 font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">
              <IconNetwork className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              :{defaultPort}
            </span>
          )}
          {hasSecrets && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">
              <IconShieldLock className="w-3 h-3 text-amber-500 dark:text-amber-400" />
              Auto-Secret
            </span>
          )}
          {metadata.tags?.includes('sql') && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">
              <IconDatabase className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              Database
            </span>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="px-5 py-3 border-t border-zinc-100 dark:border-[#1F1F24] bg-zinc-50/70 dark:bg-[#0E0E12]/40 flex items-center justify-between rounded-b-xl">
        <div className="flex items-center gap-1">
          {metadata.website && (
            <a
              href={metadata.website}
              target="_blank"
              rel="noreferrer"
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1.5 rounded-md hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors"
              title="Official Website"
            >
              <IconWorld className="w-3.5 h-3.5" />
            </a>
          )}
          {metadata.documentation && (
            <a
              href={metadata.documentation}
              target="_blank"
              rel="noreferrer"
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1.5 rounded-md hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors"
              title="Documentation"
            >
              <IconExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={() => openDeployModal(template)}
          className="gap-1.5 font-medium text-xs px-3 shadow-sm hover:shadow-[0_0_12px_rgba(37,99,235,0.3)]"
        >
          <IconPlayerPlay className="w-3 h-3 fill-current" />
          Deploy
        </Button>
      </div>
    </Card>
  );
}

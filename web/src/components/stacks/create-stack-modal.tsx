import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  IconStack2,
  IconCode,
  IconCopy,
  IconLoader2,
  IconRocket,
  IconTemplate,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { ComposeEditor } from '../editor/compose-editor';
import { useDeployStack } from '../../hooks/use-stacks';

interface CreateStackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (stackName: string) => void;
}

const PRESETS: Record<string, { label: string; desc: string; yaml: string }> = {
  nginx: {
    label: 'Nginx Web Server',
    desc: 'Lightweight alpine web server with port 80 exposed',
    yaml: `services:
  web:
    image: nginx:alpine
    container_name: my-web-server
    restart: unless-stopped
    ports:
      - "8080:80"
`,
  },
  node_redis: {
    label: 'Node.js & Redis',
    desc: 'App server paired with high-performance in-memory cache',
    yaml: `services:
  app:
    image: node:20-alpine
    container_name: node-service
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
    depends_on:
      - redis

  redis:
    image: redis:alpine
    container_name: redis-cache
    restart: unless-stopped
    ports:
      - "6379:6379"
`,
  },
  postgres: {
    label: 'PostgreSQL Database',
    desc: 'Relational database with persistent storage volume',
    yaml: `services:
  db:
    image: postgres:16-alpine
    container_name: postgres-db
    restart: always
    environment:
      POSTGRES_USER: appuser
      POSTGRES_PASSWORD: changeme_secret
      POSTGRES_DB: appdb
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
`,
  },
  wordpress: {
    label: 'WordPress & MySQL',
    desc: 'Complete CMS stack with MySQL backend and persistent volumes',
    yaml: `services:
  wordpress:
    image: wordpress:latest
    container_name: wordpress-site
    restart: always
    ports:
      - "8000:80"
    environment:
      WORDPRESS_DB_HOST: db:3306
      WORDPRESS_DB_USER: wordpress
      WORDPRESS_DB_PASSWORD: wp_password
      WORDPRESS_DB_NAME: wordpress
    volumes:
      - wp_data:/var/www/html
    depends_on:
      - db

  db:
    image: mysql:8.0
    container_name: wordpress-db
    restart: always
    environment:
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wordpress
      MYSQL_PASSWORD: wp_password
      MYSQL_RANDOM_ROOT_PASSWORD: '1'
    volumes:
      - db_data:/var/lib/mysql

volumes:
  wp_data:
  db_data:
`,
  },
  blank: {
    label: 'Blank Template',
    desc: 'Clean starting point for your custom services',
    yaml: `services:
  example:
    image: alpine:latest
    command: ["sleep", "infinity"]
`,
  },
};

export function CreateStackModal({ isOpen, onClose, onSuccess }: CreateStackModalProps) {
  const [name, setName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string>('nginx');
  const [yaml, setYaml] = useState<string>(PRESETS.nginx.yaml);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const deployMutation = useDeployStack();

  const handleSelectPreset = (key: string) => {
    setSelectedPreset(key);
    setYaml(PRESETS[key].yaml);
    if (!name) {
      setName(key === 'blank' ? 'custom-stack' : key + '-stack');
    }
  };

  const handleDeploy = async () => {
    const trimmedName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!trimmedName) {
      toast.error('Please enter a valid stack name');
      return;
    }

    if (!yaml.trim()) {
      toast.error('Compose definition cannot be empty');
      return;
    }

    setIsSubmitting(true);
    try {
      await deployMutation.mutateAsync({
        name: trimmedName,
        compose_yaml: yaml,
      });
      toast.success(`Stack "${trimmedName}" deployed successfully!`);
      onSuccess?.(trimmedName);
      onClose();
    } catch (err: any) {
      toast.error('Failed to deploy stack', { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[86vh] p-0 flex flex-col bg-white dark:bg-[#0F0F13] border-zinc-200 dark:border-[#272730] shadow-2xl rounded-2xl overflow-hidden transition-colors">
        {/* Top Header */}
        <DialogHeader className="px-6 py-3.5 border-b border-zinc-200 dark:border-[#1F1F24] bg-zinc-50 dark:bg-[#0A0A0D] flex flex-row items-center justify-between shrink-0 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
              <IconStack2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Create Custom Compose Stack
                </DialogTitle>
                <Badge variant="neutral" className="text-[10px] font-mono">
                  Compose v2
                </Badge>
              </div>
              <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Author or paste standard docker-compose.yml with live Monaco validation
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 mr-6">
            <Button
              variant="surface"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(yaml);
                toast.success('Compose YAML copied to clipboard');
              }}
              className="h-7 px-2.5 text-xs gap-1"
              title="Copy YAML"
            >
              <IconCopy className="w-3.5 h-3.5" />
              Copy
            </Button>

            <Button
              variant="primary"
              size="sm"
              disabled={isSubmitting || !name.trim()}
              onClick={handleDeploy}
              className="h-7 px-3.5 text-xs gap-1.5 shadow-sm"
              title="Deploy Stack Now"
            >
              {isSubmitting ? (
                <IconLoader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <IconRocket className="w-3.5 h-3.5" />
              )}
              {isSubmitting ? 'Deploying...' : 'Deploy Stack'}
            </Button>
          </div>
        </DialogHeader>

        {/* Configuration Bar: Stack Name & Starter Presets */}
        <div className="px-6 py-3 border-b border-zinc-200 dark:border-[#1F1F24] bg-white dark:bg-[#121216] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 transition-colors">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <label htmlFor="stack-name" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">
              Stack Name:
            </label>
            <input
              id="stack-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))}
              placeholder="e.g. production-api"
              className="flex-1 h-8 px-3 text-xs font-mono bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-[#272730] rounded-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Quick Presets Pill Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 mr-1 flex items-center gap-1">
              <IconTemplate className="w-3 h-3" />
              Presets:
            </span>
            {Object.entries(PRESETS).map(([key, item]) => {
              const isSelected = selectedPreset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectPreset(key)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 border border-transparent'
                  }`}
                  title={item.desc}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Monaco Compose Editor Main Body */}
        <div className="flex-1 w-full h-full min-h-0 bg-white dark:bg-[#09090B]">
          <ComposeEditor
            value={yaml}
            onChange={(val) => setYaml(val || '')}
            readOnly={false}
          />
        </div>

        {/* Modal Footer info */}
        <div className="px-6 py-2.5 border-t border-zinc-200 dark:border-[#1F1F24] bg-zinc-50 dark:bg-[#0A0A0D] flex items-center justify-between shrink-0 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono transition-colors">
          <div className="flex items-center gap-2">
            <IconCode className="w-3.5 h-3.5 text-zinc-400" />
            <span>docker-compose.yml</span>
          </div>
          <div>
            <span>Validated by Monaco Language Services</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

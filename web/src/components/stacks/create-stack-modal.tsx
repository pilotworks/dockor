import { useState } from 'react';
import { useDeployStack } from '../../hooks/use-stacks';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  IconStack2,
  IconX,
  IconPlus,
  IconTrash,
  IconFileCode,
  IconRocket,
} from '@tabler/icons-react';
import { toast } from 'sonner';

interface CreateStackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (stackId: string) => void;
}

const PRESETS: Record<string, { label: string; yaml: string }> = {
  blank: {
    label: 'Custom / Blank',
    yaml: `services:
  app:
    image: alpine:latest
    command: ["sleep", "infinity"]
    restart: unless-stopped
`,
  },
  nginx: {
    label: 'Nginx Web Server',
    yaml: `services:
  web:
    image: nginx:alpine
    container_name: web-server
    ports:
      - "8080:80"
    restart: unless-stopped
`,
  },
  noderedis: {
    label: 'Node.js + Redis Cache',
    yaml: `services:
  app:
    image: node:20-alpine
    container_name: node-service
    ports:
      - "3000:3000"
    environment:
      - REDIS_HOST=cache
    depends_on:
      - cache
    restart: unless-stopped

  cache:
    image: redis:alpine
    container_name: redis-cache
    restart: unless-stopped
`,
  },
  postgres: {
    label: 'PostgreSQL + pgAdmin',
    yaml: `services:
  db:
    image: postgres:16-alpine
    container_name: postgres-db
    environment:
      POSTGRES_USER: \${DB_USER:-dockor}
      POSTGRES_PASSWORD: \${DB_PASSWORD:-secretpassword}
      POSTGRES_DB: \${DB_NAME:-dockor_db}
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: pgadmin-ui
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@dockor.local
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - db
    restart: unless-stopped

volumes:
  pgdata:
`,
  },
  wordpress: {
    label: 'WordPress + MariaDB',
    yaml: `services:
  wordpress:
    image: wordpress:latest
    container_name: wordpress-app
    ports:
      - "8080:80"
    environment:
      WORDPRESS_DB_HOST: db
      WORDPRESS_DB_USER: wp_user
      WORDPRESS_DB_PASSWORD: wp_password
      WORDPRESS_DB_NAME: wordpress
    volumes:
      - wp_data:/var/www/html
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: mariadb:10.11
    container_name: wordpress-db
    environment:
      MYSQL_ROOT_PASSWORD: root_password
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wp_user
      MYSQL_PASSWORD: wp_password
    volumes:
      - db_data:/var/lib/mysql
    restart: unless-stopped

volumes:
  wp_data:
  db_data:
`,
  },
};

export function CreateStackModal({ isOpen, onClose, onSuccess }: CreateStackModalProps) {
  const [name, setName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('nginx');
  const [composeYaml, setComposeYaml] = useState(PRESETS.nginx.yaml);
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);

  const deployMutation = useDeployStack();

  if (!isOpen) return null;

  const handleSelectPreset = (key: string) => {
    setSelectedPreset(key);
    if (PRESETS[key]) {
      setComposeYaml(PRESETS[key].yaml);
    }
  };

  const handleAddEnv = () => setEnvVars([...envVars, { key: '', value: '' }]);
  const handleRemoveEnv = (index: number) => setEnvVars(envVars.filter((_, i) => i !== index));
  const handleEnvChange = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...envVars];
    updated[index][field] = val;
    setEnvVars(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!cleanName) {
      toast.error('Stack name is required');
      return;
    }

    if (!composeYaml.trim()) {
      toast.error('Compose YAML content is required');
      return;
    }

    const variables: Record<string, any> = {};
    for (const item of envVars) {
      if (item.key.trim()) {
        variables[item.key.trim()] = item.value.trim();
      }
    }

    try {
      const result = await deployMutation.mutateAsync({
        name: cleanName,
        compose_yaml: composeYaml.trim(),
        variables: Object.keys(variables).length > 0 ? variables : undefined,
      });

      toast.success('Stack deployed successfully!', {
        description: `Stack "${cleanName}" is running.`,
      });
      onClose();
      if (onSuccess && result?.id) {
        onSuccess(result.id);
      }
    } catch (err: any) {
      toast.error('Failed to deploy stack', { description: err.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-[#23232A] p-6 shadow-2xl space-y-5 text-zinc-900 dark:text-zinc-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
              <IconStack2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Deploy New Compose Stack</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Define services, networking, and volumes using standard Docker Compose YAML.
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
          {/* Stack Name & Preset Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Stack Name <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. my-web-app"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="font-mono text-xs"
                required
              />
              <span className="text-[11px] text-zinc-500">
                Alphanumeric characters, dashes or underscores
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Starter Template Preset
              </label>
              <select
                value={selectedPreset}
                onChange={(e) => handleSelectPreset(e.target.value)}
                className="w-full text-xs h-9 px-3 rounded-lg border border-zinc-200 dark:border-[#272730] bg-zinc-50 dark:bg-[#16161C] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {Object.entries(PRESETS).map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.label}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-zinc-500">
                Quickly populate with common production architectures
              </span>
            </div>
          </div>

          {/* Compose YAML Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <IconFileCode className="w-4 h-4 text-purple-500" />
                <span>docker-compose.yml</span>
              </label>
              <Badge variant="outline" className="text-[10px] font-mono">
                YAML Spec 3.8+
              </Badge>
            </div>
            <div className="relative rounded-xl border border-zinc-200 dark:border-[#272730] bg-zinc-950 overflow-hidden shadow-inner">
              <textarea
                value={composeYaml}
                onChange={(e) => setComposeYaml(e.target.value)}
                rows={12}
                className="w-full p-4 font-mono text-xs text-zinc-200 bg-transparent focus:outline-none resize-y leading-relaxed"
                placeholder="version: '3.8'&#10;services:&#10;  ..."
                required
              />
            </div>
          </div>

          {/* Environment Variables */}
          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-[#1F1F24]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Environment Variables (.env)
                </span>
                <p className="text-[11px] text-zinc-500">
                  Variables injected into container environment and compose interpolation.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAddEnv} className="gap-1 text-xs">
                <IconPlus className="w-3.5 h-3.5" /> Add Variable
              </Button>
            </div>

            {envVars.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto p-1">
                {envVars.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder="KEY (e.g. PORT)"
                      value={item.key}
                      onChange={(e) => handleEnvChange(idx, 'key', e.target.value)}
                      className="font-mono text-xs flex-1"
                    />
                    <Input
                      placeholder="VALUE"
                      value={item.value}
                      onChange={(e) => handleEnvChange(idx, 'value', e.target.value)}
                      className="font-mono text-xs flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveEnv(idx)}
                      className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                      title="Remove variable"
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-200 dark:border-[#23232A]">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={deployMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={deployMutation.isPending}
              className="gap-1.5"
            >
              <IconRocket className="w-4 h-4" />
              <span>{deployMutation.isPending ? 'Deploying...' : 'Deploy Stack'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

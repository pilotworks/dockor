import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTemplateStore } from '../../stores/use-template-store';
import { useDeployStack } from '../../hooks/use-stacks';
import { usePreviewTemplate } from '../../hooks/use-templates';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  IconRefresh,
  IconAlertTriangle,
  IconCheck,
  IconCode,
  IconShieldLock,
  IconNetwork,
  IconEye,
  IconEyeOff,
  IconCopy,
} from '@tabler/icons-react';

export function DeployModal() {
  const { activeDeployTemplate: template, closeDeployModal } = useTemplateStore();
  const navigate = useNavigate();

  const [stackName, setStackName] = useState('');
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [showSecretMap, setShowSecretMap] = useState<Record<string, boolean>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [renderedCompose, setRenderedCompose] = useState<string>('');

  const previewMutation = usePreviewTemplate();
  const deployMutation = useDeployStack();

  useEffect(() => {
    if (template) {
      setStackName(`${template.metadata.id}-app`);
      const initial: Record<string, any> = {};
      template.variables?.forEach((v) => {
        initial[v.name] = v.default !== undefined ? v.default : '';
      });
      setFormValues(initial);
      triggerPreview(initial);
    }
  }, [template]);

  const triggerPreview = async (valuesToUse = formValues) => {
    if (!template) return;
    try {
      const res = await previewMutation.mutateAsync({
        id: template.metadata.id,
        variables: valuesToUse,
      });
      setWarnings(res.warnings || []);
      setRenderedCompose(res.rendered_compose || '');
      setFormValues((prev) => ({ ...prev, ...res.evaluated_variables }));
      if (res.warnings && res.warnings.length > 0) {
        toast.warning('Port conflict resolved automatically', {
          description: res.warnings[0],
        });
      }
    } catch (err: any) {
      toast.error('Preview evaluation error', {
        description: err.message,
      });
    }
  };

  const handleChange = (name: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const toggleShowSecret = (varName: string) => {
    setShowSecretMap((prev) => ({ ...prev, [varName]: !prev[varName] }));
  };

  const handleCopyCompose = () => {
    if (renderedCompose || template?.compose_yaml) {
      navigator.clipboard.writeText(renderedCompose || template!.compose_yaml || '');
      toast.success('Compose YAML copied to clipboard');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template) return;

    try {
      await deployMutation.mutateAsync({
        name: stackName,
        template_id: template.metadata.id,
        variables: formValues,
        compose_yaml: renderedCompose,
      });
      toast.success(`Stack "${stackName}" deployed successfully!`);
      closeDeployModal();
      navigate('/stacks');
    } catch (err: any) {
      toast.error('Stack deployment failed', {
        description: err.message,
      });
    }
  };

  if (!template) return null;

  return (
    <Dialog open={Boolean(template)} onOpenChange={(open) => !open && closeDeployModal()}>
      <DialogContent className="max-w-5xl h-[85vh] p-0 flex flex-col bg-white dark:bg-[#0F0F13] border-zinc-200 dark:border-[#272730] shadow-2xl rounded-2xl overflow-hidden transition-colors">
        {/* Modal Topbar Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-[#1F1F24] bg-zinc-50 dark:bg-[#0A0A0D] flex items-center justify-between shrink-0 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-[#141418] border border-blue-200 dark:border-[#272730] flex items-center justify-center p-2 shadow-inner">
              {template.metadata.icon ? (
                <img
                  src={template.metadata.icon}
                  alt={template.metadata.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                  {template.metadata.name.charAt(0)}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Deploy {template.metadata.name}
                </DialogTitle>
                <Badge variant="neutral" className="text-[10px] font-mono">
                  v{template.metadata.version}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Dynamic configuration and conflict-free stack deployment
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* 2-Column Split Body */}
        <div className="flex-1 flex min-h-0 divide-x divide-zinc-200 dark:divide-[#1F1F24] overflow-hidden">
          {/* Left Column: Form Controls */}
          <form
            id="deploy-form"
            onSubmit={handleSubmit}
            className="w-1/2 p-6 overflow-y-auto space-y-5"
          >
            {/* Automatic Port Collision Warning Alert */}
            {warnings.length > 0 && (
              <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-3.5 flex items-start gap-3">
                <IconAlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200/90 space-y-1">
                  <span className="font-semibold block text-amber-200">
                    Port Conflict Auto-Resolved
                  </span>
                  {warnings.map((w, i) => (
                    <p key={i} className="text-[11px] leading-relaxed">
                      {w}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Stack Identifier */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                Stack Project Name
              </label>
              <Input
                required
                value={stackName}
                onChange={(e) => setStackName(e.target.value)}
                placeholder="production-app-stack"
                className="font-mono"
              />
              <p className="text-[10px] text-zinc-400">
                Unique identifier for this compose deployment in Docker Engine.
              </p>
            </div>

            {/* Variable Fields */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-[#23232A] pb-2">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Template Variables
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {template.variables?.length || 0} parameter(s)
                </span>
              </div>

              {template.variables?.map((v) => {
                const val = formValues[v.name] ?? '';
                const isSecretVisible = showSecretMap[v.name];

                return (
                  <div key={v.name} className="space-y-1.5 bg-zinc-50 dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-xl p-3.5 transition-colors">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                        {v.type === 'port' && <IconNetwork className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                        {v.type === 'secret' && <IconShieldLock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />}
                        {v.label}
                        {v.required && <span className="text-red-500">*</span>}
                      </label>
                      <Badge variant="outline" className="font-mono text-[9px] px-1.5 py-0">
                        {v.type}
                      </Badge>
                    </div>

                    {v.type === 'secret' ? (
                      <div className="flex items-center gap-2 pt-1">
                        <div className="relative flex-1">
                          <Input
                            type={isSecretVisible ? 'text' : 'password'}
                            value={val}
                            onChange={(e) => handleChange(v.name, e.target.value)}
                            className="font-mono pr-8 text-xs"
                            placeholder="Generated secret"
                          />
                          <button
                            type="button"
                            onClick={() => toggleShowSecret(v.name)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                          >
                            {isSecretVisible ? (
                              <IconEyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <IconEye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <Button
                          type="button"
                          variant="surface"
                          size="sm"
                          onClick={() => triggerPreview()}
                          className="shrink-0 gap-1 text-[11px]"
                          title="Generate new cryptographic random secret"
                        >
                          <IconRefresh className="w-3 h-3 text-zinc-400" />
                          Regen
                        </Button>
                      </div>
                    ) : v.type === 'port' ? (
                      <div className="pt-1">
                        <Input
                          type="number"
                          value={val}
                          onChange={(e) => handleChange(v.name, parseInt(e.target.value) || '')}
                          onBlur={() => triggerPreview()}
                          className="font-mono text-xs"
                        />
                        {v.port_config?.auto_resolve_conflict && (
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                            Auto-checks host port usage and increments if occupied.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="pt-1">
                        <Input
                          type="text"
                          value={val}
                          onChange={(e) => handleChange(v.name, e.target.value)}
                          className="text-xs"
                        />
                      </div>
                    )}

                    {v.description && <p className="text-[10px] text-zinc-500 dark:text-zinc-400 pt-0.5">{v.description}</p>}
                  </div>
                );
              })}
            </div>
          </form>

          {/* Right Column: Live Compose YAML Preview */}
          <div className="w-1/2 bg-zinc-900 dark:bg-[#09090B] flex flex-col min-h-0">
            <div className="px-4 py-2.5 border-b border-zinc-800 dark:border-[#1F1F24] bg-zinc-950 dark:bg-[#0E0E12] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconCode className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs font-semibold text-zinc-300 font-mono">
                  docker-compose.yml
                </span>
                <Badge variant="neutral" className="text-[9px] font-mono">
                  live preview
                </Badge>
              </div>

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCopyCompose}
                title="Copy YAML"
              >
                <IconCopy className="w-3.5 h-3.5 text-zinc-400" />
              </Button>
            </div>

            <div className="flex-1 p-4 overflow-auto font-mono text-[11px] text-zinc-300 bg-zinc-900 dark:bg-[#09090B] leading-relaxed selection:bg-blue-600/30">
              <pre className="whitespace-pre">
                {renderedCompose || template.compose_yaml || '# No compose definition available'}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 dark:border-[#1F1F24] bg-zinc-50 dark:bg-[#0A0A0D] flex items-center justify-between shrink-0 transition-colors">
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            <span>Target Node: Local Host</span>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={closeDeployModal}>
              Cancel
            </Button>
            <Button
              form="deploy-form"
              type="submit"
              variant="primary"
              size="sm"
              disabled={deployMutation.isPending}
              className="gap-1.5 font-medium shadow-sm hover:shadow-[0_0_15px_rgba(37,99,235,0.3)]"
            >
              <IconCheck className="w-3.5 h-3.5" />
              {deployMutation.isPending ? 'Deploying Stack...' : 'Deploy Stack'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

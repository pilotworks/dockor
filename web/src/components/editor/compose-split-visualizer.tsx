import { useState, useEffect, useRef } from 'react';
import YAML from 'yaml';
import {
  IconColumns,
  IconCode,
  IconForms,
  IconPlus,
  IconTrash,
  IconChevronDown,
  IconChevronUp,
  IconAlertTriangle,
  IconCheck,
  IconBox,
} from '@tabler/icons-react';
import { ComposeEditor } from './compose-editor';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { cn } from '../../lib/utils';

export type VisualizerViewMode = 'split' | 'form' | 'yaml';

interface ServiceFormState {
  id: string; // unique internal key
  name: string;
  image: string;
  container_name: string;
  restart: string;
  command: string;
  ports: { host: string; container: string }[];
  environment: { key: string; value: string }[];
  volumes: { source: string; target: string }[];
}

interface ComposeSplitVisualizerProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  readOnly?: boolean;
}

export function ComposeSplitVisualizer({
  value,
  onChange,
  height = '620px',
  readOnly = false,
}: ComposeSplitVisualizerProps) {
  const [viewMode, setViewMode] = useState<VisualizerViewMode>('split');
  const [yamlError, setYamlError] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceFormState[]>([]);
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);

  // Track if edit originated from form to avoid re-parsing loops
  const isInternalFormUpdate = useRef(false);

  // Parse YAML string into structured ServiceFormState list
  const parseYamlToServices = (yamlText: string) => {
    try {
      const parsed = YAML.parse(yamlText);
      if (!parsed || typeof parsed !== 'object') {
        setYamlError(null);
        return;
      }

      setYamlError(null);

      const parsedServices = parsed.services || {};
      const newServices: ServiceFormState[] = [];

      Object.entries(parsedServices).forEach(([svcName, svcData]: [string, any], idx) => {
        if (!svcData || typeof svcData !== 'object') return;

        // Parse Ports
        const rawPorts = Array.isArray(svcData.ports) ? svcData.ports : [];
        const ports = rawPorts.map((p: any) => {
          const str = String(p).trim();
          const parts = str.split(':');
          if (parts.length >= 2) {
            return { host: parts[0], container: parts[1] };
          }
          return { host: '', container: str };
        });

        // Parse Environment
        const envList: { key: string; value: string }[] = [];
        if (Array.isArray(svcData.environment)) {
          svcData.environment.forEach((envItem: any) => {
            const str = String(envItem);
            const eqIdx = str.indexOf('=');
            if (eqIdx !== -1) {
              envList.push({
                key: str.substring(0, eqIdx).trim(),
                value: str.substring(eqIdx + 1).trim(),
              });
            } else {
              envList.push({ key: str.trim(), value: '' });
            }
          });
        } else if (svcData.environment && typeof svcData.environment === 'object') {
          Object.entries(svcData.environment).forEach(([k, v]) => {
            envList.push({ key: k, value: String(v ?? '') });
          });
        }

        // Parse Volumes
        const rawVols = Array.isArray(svcData.volumes) ? svcData.volumes : [];
        const volumes = rawVols.map((v: any) => {
          const str = String(v).trim();
          const parts = str.split(':');
          if (parts.length >= 2) {
            return { source: parts[0], target: parts[1] };
          }
          return { source: str, target: '' };
        });

        newServices.push({
          id: `svc_${idx}_${svcName}`,
          name: svcName,
          image: svcData.image || '',
          container_name: svcData.container_name || '',
          restart: svcData.restart || 'unless-stopped',
          command: Array.isArray(svcData.command)
            ? svcData.command.join(' ')
            : svcData.command || '',
          ports,
          environment: envList,
          volumes,
        });
      });

      setServices(newServices);
      if (newServices.length > 0 && !expandedServiceId) {
        setExpandedServiceId(newServices[0].id);
      }
    } catch (err: any) {
      setYamlError(err.message || 'Invalid YAML format');
    }
  };

  // Sync from external value changes
  useEffect(() => {
    if (isInternalFormUpdate.current) {
      isInternalFormUpdate.current = false;
      return;
    }
    parseYamlToServices(value);
  }, [value]);

  // Convert current form state into updated YAML document
  const syncFormToYaml = (updatedServices: ServiceFormState[]) => {
    isInternalFormUpdate.current = true;
    try {
      let doc: any = {};
      try {
        const parsed = YAML.parse(value);
        if (parsed && typeof parsed === 'object') {
          doc = parsed;
        }
      } catch {
        // Fall back to clean document if previous yaml was invalid
        doc = { version: '3.8', services: {} };
      }

      if (!doc.services || typeof doc.services !== 'object') {
        doc.services = {};
      }

      const servicesObj: Record<string, any> = {};

      updatedServices.forEach((svc) => {
        const svcKey = svc.name.trim() || 'app';
        const serviceDef: any = {};

        if (svc.image.trim()) {
          serviceDef.image = svc.image.trim();
        }
        if (svc.container_name.trim()) {
          serviceDef.container_name = svc.container_name.trim();
        }
        if (svc.restart.trim()) {
          serviceDef.restart = svc.restart.trim();
        }
        if (svc.command.trim()) {
          serviceDef.command = svc.command.trim();
        }

        // Ports
        const validPorts = svc.ports
          .filter((p) => p.container.trim() !== '')
          .map((p) => (p.host.trim() ? `${p.host.trim()}:${p.container.trim()}` : p.container.trim()));
        if (validPorts.length > 0) {
          serviceDef.ports = validPorts;
        }

        // Environment
        const validEnv: Record<string, string> = {};
        svc.environment.forEach((env) => {
          if (env.key.trim() !== '') {
            validEnv[env.key.trim()] = env.value;
          }
        });
        if (Object.keys(validEnv).length > 0) {
          serviceDef.environment = validEnv;
        }

        // Volumes
        const validVols = svc.volumes
          .filter((v) => v.source.trim() !== '' || v.target.trim() !== '')
          .map((v) => (v.target.trim() ? `${v.source.trim()}:${v.target.trim()}` : v.source.trim()));
        if (validVols.length > 0) {
          serviceDef.volumes = validVols;
        }

        servicesObj[svcKey] = serviceDef;
      });

      doc.services = servicesObj;
      const yamlStr = YAML.stringify(doc);
      onChange(yamlStr);
      setYamlError(null);
    } catch (err: any) {
      setYamlError('Failed to serialize to YAML: ' + err.message);
    }
  };

  // Form manipulation helpers
  const handleUpdateServiceField = (id: string, field: keyof ServiceFormState, val: any) => {
    const updated = services.map((s) => (s.id === id ? { ...s, [field]: val } : s));
    setServices(updated);
    syncFormToYaml(updated);
  };

  const handleAddService = () => {
    const newIdx = services.length + 1;
    const newSvc: ServiceFormState = {
      id: `svc_${Date.now()}`,
      name: `service-${newIdx}`,
      image: 'nginx:alpine',
      container_name: `app-${newIdx}`,
      restart: 'unless-stopped',
      command: '',
      ports: [{ host: `${8080 + newIdx}`, container: '80' }],
      environment: [],
      volumes: [],
    };
    const updated = [...services, newSvc];
    setServices(updated);
    setExpandedServiceId(newSvc.id);
    syncFormToYaml(updated);
  };

  const handleDeleteService = (id: string) => {
    const updated = services.filter((s) => s.id !== id);
    setServices(updated);
    if (expandedServiceId === id) {
      setExpandedServiceId(updated.length > 0 ? updated[0].id : null);
    }
    syncFormToYaml(updated);
  };

  // Ports
  const handleAddPort = (serviceId: string) => {
    const updated = services.map((s) =>
      s.id === serviceId ? { ...s, ports: [...s.ports, { host: '', container: '' }] } : s
    );
    setServices(updated);
    syncFormToYaml(updated);
  };

  const handleUpdatePort = (
    serviceId: string,
    idx: number,
    field: 'host' | 'container',
    val: string
  ) => {
    const updated = services.map((s) => {
      if (s.id !== serviceId) return s;
      const newPorts = [...s.ports];
      newPorts[idx] = { ...newPorts[idx], [field]: val };
      return { ...s, ports: newPorts };
    });
    setServices(updated);
    syncFormToYaml(updated);
  };

  const handleDeletePort = (serviceId: string, idx: number) => {
    const updated = services.map((s) => {
      if (s.id !== serviceId) return s;
      return { ...s, ports: s.ports.filter((_, i) => i !== idx) };
    });
    setServices(updated);
    syncFormToYaml(updated);
  };

  // Environment
  const handleAddEnv = (serviceId: string) => {
    const updated = services.map((s) =>
      s.id === serviceId ? { ...s, environment: [...s.environment, { key: '', value: '' }] } : s
    );
    setServices(updated);
    syncFormToYaml(updated);
  };

  const handleUpdateEnv = (
    serviceId: string,
    idx: number,
    field: 'key' | 'value',
    val: string
  ) => {
    const updated = services.map((s) => {
      if (s.id !== serviceId) return s;
      const newEnv = [...s.environment];
      newEnv[idx] = { ...newEnv[idx], [field]: val };
      return { ...s, environment: newEnv };
    });
    setServices(updated);
    syncFormToYaml(updated);
  };

  const handleDeleteEnv = (serviceId: string, idx: number) => {
    const updated = services.map((s) => {
      if (s.id !== serviceId) return s;
      return { ...s, environment: s.environment.filter((_, i) => i !== idx) };
    });
    setServices(updated);
    syncFormToYaml(updated);
  };

  // Volumes
  const handleAddVolume = (serviceId: string) => {
    const updated = services.map((s) =>
      s.id === serviceId ? { ...s, volumes: [...s.volumes, { source: '', target: '' }] } : s
    );
    setServices(updated);
    syncFormToYaml(updated);
  };

  const handleUpdateVolume = (
    serviceId: string,
    idx: number,
    field: 'source' | 'target',
    val: string
  ) => {
    const updated = services.map((s) => {
      if (s.id !== serviceId) return s;
      const newVols = [...s.volumes];
      newVols[idx] = { ...newVols[idx], [field]: val };
      return { ...s, volumes: newVols };
    });
    setServices(updated);
    syncFormToYaml(updated);
  };

  const handleDeleteVolume = (serviceId: string, idx: number) => {
    const updated = services.map((s) => {
      if (s.id !== serviceId) return s;
      return { ...s, volumes: s.volumes.filter((_, i) => i !== idx) };
    });
    setServices(updated);
    syncFormToYaml(updated);
  };

  return (
    <div className="flex flex-col border border-zinc-200 dark:border-[#23232A] rounded-xl overflow-hidden bg-white dark:bg-[#0E0E12] shadow-xs">
      {/* Visualizer Top Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-zinc-50 dark:bg-[#121216] border-b border-zinc-200 dark:border-[#23232A]">
        {/* Left: View Mode Switcher */}
        <div className="flex items-center gap-1.5 p-0.5 bg-zinc-200/80 dark:bg-[#1A1A22] rounded-lg">
          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all',
              viewMode === 'split'
                ? 'bg-white dark:bg-[#252530] text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            )}
          >
            <IconColumns className="w-3.5 h-3.5" />
            <span>Split View</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('form')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all',
              viewMode === 'form'
                ? 'bg-white dark:bg-[#252530] text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            )}
          >
            <IconForms className="w-3.5 h-3.5" />
            <span>Visual Form</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('yaml')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all',
              viewMode === 'yaml'
                ? 'bg-white dark:bg-[#252530] text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            )}
          >
            <IconCode className="w-3.5 h-3.5" />
            <span>YAML Code</span>
          </button>
        </div>

        {/* Right: Sync Status & Service Add */}
        <div className="flex items-center gap-2.5">
          {yamlError ? (
            <div
              className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-900/40"
              title={yamlError}
            >
              <IconAlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate max-w-[200px]">Syntax issue detected</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-900/40">
              <IconCheck className="w-3.5 h-3.5" />
              <span>Two-way synchronized</span>
            </div>
          )}

          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddService}
              className="gap-1.5 text-xs h-7.5"
            >
              <IconPlus className="w-3.5 h-3.5" />
              <span>Add Service</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className={cn(
          'w-full grid transition-all',
          viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 dark:divide-[#23232A]' : 'grid-cols-1'
        )}
        style={{ height }}
      >
        {/* Left Pane: Visual Form Editor */}
        {(viewMode === 'split' || viewMode === 'form') && (
          <div className="h-full overflow-y-auto p-4 space-y-3.5 bg-zinc-50/40 dark:bg-[#0A0A0E]/40">
            {services.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-zinc-200 dark:border-[#23232A] rounded-xl space-y-2">
                <IconBox className="w-8 h-8 text-zinc-400 mx-auto" />
                <p className="text-xs text-zinc-500">No services defined yet.</p>
                <Button
                  type="button"
                  variant="surface"
                  size="sm"
                  onClick={handleAddService}
                  className="gap-1 text-xs"
                >
                  <IconPlus className="w-3.5 h-3.5" />
                  Add First Service
                </Button>
              </div>
            ) : (
              services.map((svc) => {
                const isExpanded = expandedServiceId === svc.id;

                return (
                  <div
                    key={svc.id}
                    className="border border-zinc-200 dark:border-[#23232A] rounded-xl bg-white dark:bg-[#121216] shadow-xs overflow-hidden transition-all"
                  >
                    {/* Service Card Header */}
                    <div
                      onClick={() => setExpandedServiceId(isExpanded ? null : svc.id)}
                      className="flex items-center justify-between px-3.5 py-2.5 bg-zinc-50/70 dark:bg-[#15151B] cursor-pointer hover:bg-zinc-100/60 dark:hover:bg-[#191922] transition-colors"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40 shrink-0">
                          <IconBox className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            {svc.name || 'unnamed'}
                          </span>
                          <span className="ml-2 font-mono text-[11px] text-zinc-500 truncate">
                            {svc.image || 'no image'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {svc.ports.length > 0 && (
                          <Badge variant="outline" className="text-[10px] font-mono py-0">
                            {svc.ports.length} port{svc.ports.length > 1 ? 's' : ''}
                          </Badge>
                        )}
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteService(svc.id);
                            }}
                            className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                            title="Delete service"
                          >
                            <IconTrash className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isExpanded ? (
                          <IconChevronUp className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <IconChevronDown className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>
                    </div>

                    {/* Service Card Body */}
                    {isExpanded && (
                      <div className="p-3.5 space-y-3.5 border-t border-zinc-100 dark:border-[#1E1E24]">
                        {/* Name & Image Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                              Service Name
                            </label>
                            <Input
                              value={svc.name}
                              onChange={(e) => handleUpdateServiceField(svc.id, 'name', e.target.value)}
                              placeholder="e.g. web"
                              className="font-mono text-xs h-8"
                              disabled={readOnly}
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                              Docker Image
                            </label>
                            <Input
                              value={svc.image}
                              onChange={(e) => handleUpdateServiceField(svc.id, 'image', e.target.value)}
                              placeholder="e.g. nginx:alpine"
                              className="font-mono text-xs h-8"
                              disabled={readOnly}
                            />
                          </div>
                        </div>

                        {/* Container Name & Restart Policy */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                              Container Name (Optional)
                            </label>
                            <Input
                              value={svc.container_name}
                              onChange={(e) =>
                                handleUpdateServiceField(svc.id, 'container_name', e.target.value)
                              }
                              placeholder="e.g. my-app-container"
                              className="font-mono text-xs h-8"
                              disabled={readOnly}
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                              Restart Policy
                            </label>
                            <Select
                              value={svc.restart}
                              onValueChange={(val) => handleUpdateServiceField(svc.id, 'restart', val)}
                              disabled={readOnly}
                            >
                              <SelectTrigger className="text-xs h-8">
                                <SelectValue placeholder="Select policy" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unless-stopped">unless-stopped</SelectItem>
                                <SelectItem value="always">always</SelectItem>
                                <SelectItem value="on-failure">on-failure</SelectItem>
                                <SelectItem value="no">no</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Ports Mapping */}
                        <div className="space-y-1.5 pt-1 border-t border-zinc-100 dark:border-[#1E1E24]">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                              Port Mappings (Host : Container)
                            </span>
                            {!readOnly && (
                              <button
                                type="button"
                                onClick={() => handleAddPort(svc.id)}
                                className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                              >
                                <IconPlus className="w-3 h-3" /> Add Port
                              </button>
                            )}
                          </div>

                          {svc.ports.length === 0 ? (
                            <p className="text-[11px] text-zinc-400 italic">No exposed ports</p>
                          ) : (
                            <div className="space-y-1.5">
                              {svc.ports.map((p, pIdx) => (
                                <div key={pIdx} className="flex items-center gap-2">
                                  <Input
                                    value={p.host}
                                    onChange={(e) =>
                                      handleUpdatePort(svc.id, pIdx, 'host', e.target.value)
                                    }
                                    placeholder="Host (e.g. 8080)"
                                    className="font-mono text-xs h-7.5 flex-1"
                                    disabled={readOnly}
                                  />
                                  <span className="text-zinc-400 text-xs">:</span>
                                  <Input
                                    value={p.container}
                                    onChange={(e) =>
                                      handleUpdatePort(svc.id, pIdx, 'container', e.target.value)
                                    }
                                    placeholder="Container (e.g. 80)"
                                    className="font-mono text-xs h-7.5 flex-1"
                                    disabled={readOnly}
                                  />
                                  {!readOnly && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePort(svc.id, pIdx)}
                                      className="p-1 text-zinc-400 hover:text-red-500"
                                    >
                                      <IconTrash className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Environment Variables */}
                        <div className="space-y-1.5 pt-1 border-t border-zinc-100 dark:border-[#1E1E24]">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                              Environment Variables (KEY = VALUE)
                            </span>
                            {!readOnly && (
                              <button
                                type="button"
                                onClick={() => handleAddEnv(svc.id)}
                                className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                              >
                                <IconPlus className="w-3 h-3" /> Add Env
                              </button>
                            )}
                          </div>

                          {svc.environment.length === 0 ? (
                            <p className="text-[11px] text-zinc-400 italic">No environment variables</p>
                          ) : (
                            <div className="space-y-1.5">
                              {svc.environment.map((env, eIdx) => (
                                <div key={eIdx} className="flex items-center gap-2">
                                  <Input
                                    value={env.key}
                                    onChange={(e) =>
                                      handleUpdateEnv(svc.id, eIdx, 'key', e.target.value)
                                    }
                                    placeholder="KEY"
                                    className="font-mono text-xs h-7.5 flex-1"
                                    disabled={readOnly}
                                  />
                                  <span className="text-zinc-400 text-xs">=</span>
                                  <Input
                                    value={env.value}
                                    onChange={(e) =>
                                      handleUpdateEnv(svc.id, eIdx, 'value', e.target.value)
                                    }
                                    placeholder="VALUE"
                                    className="font-mono text-xs h-7.5 flex-1"
                                    disabled={readOnly}
                                  />
                                  {!readOnly && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteEnv(svc.id, eIdx)}
                                      className="p-1 text-zinc-400 hover:text-red-500"
                                    >
                                      <IconTrash className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Volumes */}
                        <div className="space-y-1.5 pt-1 border-t border-zinc-100 dark:border-[#1E1E24]">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                              Volume Mounts (Host Path : Container Path)
                            </span>
                            {!readOnly && (
                              <button
                                type="button"
                                onClick={() => handleAddVolume(svc.id)}
                                className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                              >
                                <IconPlus className="w-3 h-3" /> Add Volume
                              </button>
                            )}
                          </div>

                          {svc.volumes.length === 0 ? (
                            <p className="text-[11px] text-zinc-400 italic">No volumes mounted</p>
                          ) : (
                            <div className="space-y-1.5">
                              {svc.volumes.map((v, vIdx) => (
                                <div key={vIdx} className="flex items-center gap-2">
                                  <Input
                                    value={v.source}
                                    onChange={(e) =>
                                      handleUpdateVolume(svc.id, vIdx, 'source', e.target.value)
                                    }
                                    placeholder="Host (./data or volume_name)"
                                    className="font-mono text-xs h-7.5 flex-1"
                                    disabled={readOnly}
                                  />
                                  <span className="text-zinc-400 text-xs">:</span>
                                  <Input
                                    value={v.target}
                                    onChange={(e) =>
                                      handleUpdateVolume(svc.id, vIdx, 'target', e.target.value)
                                    }
                                    placeholder="Container (/app/data)"
                                    className="font-mono text-xs h-7.5 flex-1"
                                    disabled={readOnly}
                                  />
                                  {!readOnly && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteVolume(svc.id, vIdx)}
                                      className="p-1 text-zinc-400 hover:text-red-500"
                                    >
                                      <IconTrash className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Right Pane: Monaco YAML Editor */}
        {(viewMode === 'split' || viewMode === 'yaml') && (
          <div className="h-full w-full bg-white dark:bg-[#0A0A0D] overflow-hidden">
            <ComposeEditor
              value={value}
              onChange={(val) => {
                const newText = val || '';
                onChange(newText);
                parseYamlToServices(newText);
              }}
              readOnly={readOnly}
              height="100%"
            />
          </div>
        )}
      </div>
    </div>
  );
}

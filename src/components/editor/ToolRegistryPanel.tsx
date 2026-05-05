import React, { useState } from 'react';
import { ToolRegistry } from '@/lib/tools';
import { Blocks, CheckCircle2, AlertTriangle, Package, Key, Settings, LayoutGrid, List, AlignJustify, Search } from 'lucide-react';

interface ToolRegistryPanelProps {
  files: Record<string, string>;
  appMode: string;
  onInject: (newFiles: Record<string, string>, toolName: string) => void;
  onLog: (msg: string) => void;
}

export function ToolRegistryPanel({ files, appMode, onInject, onLog }: ToolRegistryPanelProps) {
  const allTools = ToolRegistry.getTools();
  const [error, setError] = useState<string | null>(null);
  
  const [viewMode, setViewMode] = useState<'compact' | 'list' | 'grid'>('compact');
  const [searchQuery, setSearchQuery] = useState('');

  // Normalize appMode string to match tool registry modes
  let mappedMode = appMode.toLowerCase().replace(/[^a-z0-9]/g, '-');
  if (appMode.includes('React / Vite')) mappedMode = 'react-vite';
  else if (appMode.includes('Next.js')) mappedMode = 'nextjs-app-router';
  else if (appMode.includes('Node')) mappedMode = 'node-express';
  else if (appMode.includes('Laravel')) mappedMode = 'laravel';
  else if (appMode.includes('PHP')) mappedMode = 'php-native';
  else if (appMode.includes('Static')) mappedMode = 'static';

  const handleInject = (toolId: string, toolName: string) => {
    try {
      setError(null);
      const updatedFiles = ToolRegistry.safeInject(toolId, files, mappedMode);
      onInject(updatedFiles, toolName);
      onLog(`[SYSTEM] Safely injected tool: ${toolName}. Pre and Post snapshots created.`);
    } catch (e: any) {
      setError(e.message);
      onLog(`[ERROR] Failed to inject tool ${toolName}: ${e.message}`);
    }
  };

  const filteredTools = allTools.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.category.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 border-r border-slate-800 text-slate-300">
      <div className="p-3 border-b border-slate-800 bg-slate-900 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Blocks className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Tool Registry</span>
          </div>
          
          <div className="flex bg-slate-800 p-0.5 rounded">
             <button onClick={() => setViewMode('compact')} className={`p-1 rounded ${viewMode === 'compact' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'}`} title="Compact View"><AlignJustify className="w-3.5 h-3.5" /></button>
             <button onClick={() => setViewMode('list')} className={`p-1 rounded ${viewMode === 'list' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'}`} title="List View"><List className="w-3.5 h-3.5" /></button>
             <button onClick={() => setViewMode('grid')} className={`p-1 rounded ${viewMode === 'grid' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'}`} title="Grid View"><LayoutGrid className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <div className="relative">
           <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
           <input 
             type="text" 
             placeholder="Search tools or categories..." 
             value={searchQuery}
             onChange={e => setSearchQuery(e.target.value)}
             className="w-full bg-slate-800 border border-slate-700 rounded pl-8 pr-3 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-500"
           />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {error && (
          <div className="mb-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-2 rounded flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className={
          viewMode === 'grid' ? "grid grid-cols-2 gap-2" : 
          viewMode === 'list' ? "flex flex-col gap-2" : 
          "flex flex-col gap-1"
        }>
          {filteredTools.map(tool => {
            const isUnsupported = tool.incompatibleModes.includes(mappedMode);
            const isSupported = tool.supportedModes.includes(mappedMode);
            
            let compatibilityBadge = 'Backend Required';
            let badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            
            if (isSupported) {
              compatibilityBadge = 'Supported';
              badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            } else if (isUnsupported) {
              compatibilityBadge = 'Unsupported';
              badgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
            }

            let isInstalled = false;
            try {
              isInstalled = tool.isInstalled(files);
            } catch(e) {}

            const InstallButton = () => (
              isInstalled ? (
                <button disabled className="py-1 px-2 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded flex items-center justify-center gap-1.5 border border-emerald-500/20 w-full">
                  <CheckCircle2 className="w-3 h-3" /> Installed
                </button>
              ) : isUnsupported ? (
                <button disabled className="py-1 px-2 bg-slate-800/50 text-slate-500 text-[10px] font-bold rounded cursor-not-allowed w-full">
                  Incompatible
                </button>
              ) : (
                <button 
                  onClick={() => handleInject(tool.id, tool.name)}
                  className="py-1 px-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded transition-colors flex items-center justify-center gap-1.5 w-full"
                >
                  <Settings className="w-3 h-3" /> Inject
                </button>
              )
            );

            if (viewMode === 'compact') {
              return (
                <div key={tool.id} className="p-2 rounded border border-slate-800 bg-slate-900/50 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-200 truncate">{tool.name}</h3>
                      <div className={`shrink-0 px-1.5 py-0.5 text-[8px] font-bold rounded border ${badgeClass}`}>{compatibilityBadge}</div>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{tool.description}</p>
                  </div>
                  <div className="w-24 shrink-0">
                    <InstallButton />
                  </div>
                </div>
              );
            }

            if (viewMode === 'list') {
              return (
                <div key={tool.id} className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/50 flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xs font-bold text-slate-200">{tool.name}</h3>
                      <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded shrink-0">{tool.category}</span>
                      <div className={`shrink-0 px-1.5 py-0.5 text-[8px] font-bold rounded border ${badgeClass} ml-auto`}>{compatibilityBadge}</div>
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-2 leading-snug">{tool.description}</p>
                    
                    <div className="mt-2 flex gap-3 text-[9px]">
                      {tool.requiredPackages.length > 0 && (
                        <div className="flex items-center gap-1 text-slate-500">
                          <Package className="w-3 h-3" /> {tool.requiredPackages.length} pkgs
                        </div>
                      )}
                      {tool.requiredEnvVars.length > 0 && (
                        <div className="flex items-center gap-1 text-slate-500">
                          <Key className="w-3 h-3" /> {tool.requiredEnvVars.length} env vars
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="w-24 shrink-0 flex flex-col justify-center self-center">
                    <InstallButton />
                  </div>
                </div>
              );
            }

            // Grid View
            return (
              <div key={tool.id} className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/50 flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xs font-bold text-slate-200 truncate">{tool.name}</h3>
                </div>
                <div className={`inline-flex self-start mb-2 px-1.5 py-0.5 text-[8px] font-bold rounded border ${badgeClass}`}>
                  {compatibilityBadge}
                </div>
                <p className="text-[10px] text-slate-400 line-clamp-2 leading-snug mb-3 flex-1">{tool.description}</p>
                <div className="mt-auto">
                  <InstallButton />
                </div>
              </div>
            );
          })}
          
          {filteredTools.length === 0 && (
            <div className="text-center p-4 text-[10px] text-slate-500">No tools found matching your search.</div>
          )}
        </div>
      </div>
    </div>
  );
}

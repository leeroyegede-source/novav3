import React, { useEffect, useState } from 'react';
import { ProjectMemory, ProjectMemoryState, MemoryItem } from '@/lib/memory/projectMemory';
import { ProjectScanner } from '@/lib/memory/scanner';
import { Brain, RefreshCw, AlertTriangle, CheckCircle2, ListTodo, FileCode, Search, Trash2 } from 'lucide-react';

interface MemoryPanelProps {
  files: Record<string, string>;
  appMode: string;
  onLog: (msg: string) => void;
}

export function MemoryPanel({ files, appMode, onLog }: MemoryPanelProps) {
  const [memory, setMemory] = useState<ProjectMemoryState | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'routes' | 'apis' | 'errors' | 'todos'>('summary');

  const loadMemory = () => {
    setMemory(ProjectMemory.getMemory());
  };

  useEffect(() => {
    loadMemory();
    const interval = setInterval(loadMemory, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleScan = () => {
    onLog(`[MEMORY] Scanning project structure...`);
    ProjectScanner.scan(files, appMode);
    loadMemory();
    onLog(`[MEMORY] Project scan complete. Architecture mapped.`);
  };

  const handleClearErrors = () => {
    ProjectMemory.clearFailedItems();
    loadMemory();
    onLog(`[MEMORY] Cleared failed execution memory.`);
  };

  if (!memory) return null;

  const groupedItems = memory.items.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, MemoryItem[]>);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 border-r border-slate-800 text-slate-300">
      <div className="p-3 border-b border-slate-800 bg-slate-900 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold uppercase tracking-wider">Project Memory</span>
          </div>
          <button onClick={handleScan} className="text-[10px] bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white px-2 py-1 rounded flex items-center gap-1 transition-colors">
            <Search className="w-3 h-3" /> Re-Scan
          </button>
        </div>
        
        <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
          {['summary', 'routes', 'apis', 'errors', 'todos'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`text-[10px] uppercase font-bold px-2 py-1 rounded whitespace-nowrap transition-colors ${activeTab === tab ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'summary' && (
          <div className="space-y-4">
            <div className="p-3 rounded border border-slate-800 bg-slate-900/50">
              <h3 className="text-[10px] uppercase font-bold text-slate-500 mb-1">Architecture</h3>
              <p className="text-xs font-bold text-indigo-300">{memory.framework}</p>
              <p className="text-[10px] text-slate-400 mt-1">App Mode: {memory.project_mode}</p>
            </div>
            
            <div className="p-3 rounded border border-slate-800 bg-slate-900/50">
              <h3 className="text-[10px] uppercase font-bold text-slate-500 mb-2">Health Metrics</h3>
              <div className="space-y-2">
                {memory.last_stable_version_id ? (
                  <div className="flex items-center gap-2 text-[10px] text-emerald-400"><CheckCircle2 className="w-3 h-3" /> Stable Version Tracked ({memory.last_stable_version_id})</div>
                ) : (
                  <div className="flex items-center gap-2 text-[10px] text-slate-500"><AlertTriangle className="w-3 h-3" /> No Stable Version</div>
                )}
                {memory.last_failed_version_id && (
                  <div className="flex items-center gap-2 text-[10px] text-rose-400"><AlertTriangle className="w-3 h-3" /> Last Build Failed ({memory.last_failed_version_id})</div>
                )}
              </div>
            </div>

            {(groupedItems['tool'] || []).length > 0 && (
              <div className="p-3 rounded border border-slate-800 bg-slate-900/50">
                <h3 className="text-[10px] uppercase font-bold text-slate-500 mb-2">Installed Tools</h3>
                <div className="flex flex-wrap gap-2">
                  {groupedItems['tool'].map(t => (
                    <span key={t.id} className="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded">{t.title}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {(activeTab === 'routes' || activeTab === 'apis') && (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 mb-3">Auto-detected {activeTab} mapped to memory.</p>
            {(groupedItems[activeTab === 'routes' ? 'route' : 'api'] || []).map(item => (
              <div key={item.id} className="p-2 border border-slate-800 rounded bg-slate-900/30 flex items-start gap-2">
                <FileCode className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-200">{item.title}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-1">{item.source_file}</p>
                </div>
              </div>
            ))}
            {(groupedItems[activeTab === 'routes' ? 'route' : 'api'] || []).length === 0 && <p className="text-xs text-slate-500">None detected.</p>}
          </div>
        )}

        {activeTab === 'errors' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
               <p className="text-xs text-slate-400">Known runtime/build errors</p>
               <button onClick={handleClearErrors} className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Clear</button>
            </div>
            {(groupedItems['error'] || []).map(item => (
              <div key={item.id} className="p-3 border border-rose-500/30 rounded bg-rose-500/5">
                <p className="text-xs font-bold text-rose-400 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {item.title}</p>
                <p className="text-[10px] text-rose-300/80 mt-2 font-mono whitespace-pre-wrap">{item.content}</p>
              </div>
            ))}
            {(groupedItems['error'] || []).length === 0 && <p className="text-xs text-emerald-500 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Zero active errors tracked.</p>}
          </div>
        )}

        {activeTab === 'todos' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">Active instructions and goals.</p>
            {(groupedItems['todo'] || []).concat(groupedItems['user_instruction'] || []).map(item => (
              <div key={item.id} className="p-3 border border-amber-500/30 rounded bg-amber-500/5">
                <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5"><ListTodo className="w-3.5 h-3.5" /> {item.title}</p>
                <p className="text-[10px] text-amber-300/80 mt-2">{item.content}</p>
              </div>
            ))}
            {(groupedItems['todo'] || []).length === 0 && (groupedItems['user_instruction'] || []).length === 0 && <p className="text-xs text-slate-500">No active TODOs.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

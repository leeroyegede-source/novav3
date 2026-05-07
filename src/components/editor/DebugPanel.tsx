import React, { useState, useEffect } from 'react';
import { Bug, X } from 'lucide-react';

export function DebugPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  
  // Only show in development
  if (process.env.NODE_ENV !== 'development') return null;

  useEffect(() => {
    const loadLogs = () => {
      const stored = JSON.parse(localStorage.getItem('nova_debug_logs') || '[]');
      setLogs(stored);
    };

    loadLogs();
    
    const handleUpdate = () => loadLogs();
    window.addEventListener('nova-debug-updated', handleUpdate);
    return () => window.removeEventListener('nova-debug-updated', handleUpdate);
  }, []);

  const hasErrors = logs.some(l => !l.success);

  if (!isOpen) {
    return (
      <div className="relative">
        <button 
          onClick={() => setIsOpen(true)}
          className={`p-1.5 rounded-md transition-colors flex items-center justify-center ${hasErrors ? 'text-rose-500 bg-rose-500/10 hover:bg-rose-500/20' : 'text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'}`}
          title="Supabase Debug Logs"
        >
          <Bug className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const clearLogs = () => {
    localStorage.removeItem('nova_debug_logs');
    setLogs([]);
    window.dispatchEvent(new Event('nova-debug-updated'));
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(false)}
        className={`p-1.5 rounded-md transition-colors flex items-center justify-center ${hasErrors ? 'text-rose-500 bg-rose-500/20' : 'text-emerald-500 bg-emerald-500/20'}`}
        title="Supabase Debug Logs"
      >
        <Bug className="w-3.5 h-3.5" />
      </button>
      
      <div className="absolute top-10 right-0 z-50 w-[400px] bg-slate-900 border border-rose-500/30 rounded-xl shadow-2xl flex flex-col max-h-[60vh]">
      <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-rose-950/20 rounded-t-xl">
        <h2 className="text-sm font-bold flex items-center gap-2 text-rose-400">
          <Bug className="w-4 h-4" />
          Developer Debug Logs (Supabase)
        </h2>
        <div className="flex items-center gap-1">
          <button onClick={clearLogs} className="px-2 py-1 text-xs hover:bg-slate-800 rounded-md transition-colors text-slate-400">
            Clear
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-800 rounded-md transition-colors text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="p-2 overflow-y-auto flex-1 text-xs font-mono space-y-2">
        {logs.length === 0 ? (
          <div className="p-4 text-center text-slate-500">No debug logs yet.</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className={`p-2 rounded border ${log.success ? 'bg-emerald-950/20 border-emerald-900/30' : 'bg-rose-950/20 border-rose-900/30'}`}>
              <div className="flex justify-between mb-1">
                <span className={log.success ? 'text-emerald-400' : 'text-rose-400'}>{log.action.toUpperCase()}</span>
                <span className="text-slate-500 text-[10px]">{new Date(log.time).toLocaleTimeString()}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 text-slate-300">
                <div className="text-slate-500">Table:</div><div>{log.table}</div>
                <div className="text-slate-500">Project:</div><div className="truncate">{log.projectId}</div>
                <div className="text-slate-500">User:</div><div className="truncate">{log.userId}</div>
              </div>
              {!log.success && log.errorDetail && (
                <div className="mt-2 p-1.5 bg-black/40 rounded text-rose-300 break-all overflow-x-auto whitespace-pre-wrap">
                  {log.errorDetail}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      </div>
    </div>
  );
}

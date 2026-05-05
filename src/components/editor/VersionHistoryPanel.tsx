import React, { useEffect, useState } from 'react';
import { VersionManager, ProjectSnapshot } from '@/lib/memory/versionManager';
import { History, RotateCcw, GitCompare, FileCode } from 'lucide-react';

interface VersionHistoryPanelProps {
  currentFiles: Record<string, string>;
  onRestore: (files: Record<string, string>) => void;
  onCompare: (files: Record<string, string>) => void;
}

export function VersionHistoryPanel({ currentFiles, onRestore, onCompare }: VersionHistoryPanelProps) {
  const [history, setHistory] = useState<ProjectSnapshot[]>([]);

  useEffect(() => {
    // Refresh history occasionally or rely on an interval
    const refresh = () => setHistory(VersionManager.getHistory().reverse());
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 border-r border-slate-800 text-slate-300">
      <div className="p-3 border-b border-slate-800 bg-slate-900 flex items-center gap-2">
        <History className="w-4 h-4 text-indigo-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Version History</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {history.length === 0 ? (
          <div className="text-xs text-slate-500 text-center p-4">No snapshots yet.</div>
        ) : (
          history.map((snapshot, i) => {
            const date = new Date(snapshot.timestamp).toLocaleString();
            const isLatest = i === 0;
            return (
              <div key={snapshot.id} className={`p-3 rounded border ${isLatest ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-slate-900 border-slate-800'} transition-all`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-200">v{history.length - i}</span>
                  <span className="text-[10px] text-slate-500">{date}</span>
                </div>
                <div className="text-xs text-slate-400 mb-3">{snapshot.message}</div>
                <div className="flex items-center gap-2 mt-2">
                  <button 
                    onClick={() => onRestore(snapshot.files)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1 bg-slate-800 hover:bg-indigo-600 hover:text-white rounded text-[10px] font-bold transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" /> Restore
                  </button>
                  <button 
                    onClick={() => onCompare(snapshot.files)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-bold transition-colors"
                  >
                    <GitCompare className="w-3 h-3" /> Compare
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

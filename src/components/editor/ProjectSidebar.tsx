import React, { useEffect, useState } from 'react';
import { FolderGit2, Plus, Download, LayoutTemplate, Clock } from 'lucide-react';

export function ProjectSidebar() {
  const [recentProjects, setRecentProjects] = useState<any[]>([]);

  useEffect(() => {
    try {
      const recent = JSON.parse(localStorage.getItem('nova_recent_projects') || '[]');
      setRecentProjects(recent);
    } catch (e) {}
    
    // Poll for updates in case other components change it
    const int = setInterval(() => {
      try {
        const recent = JSON.parse(localStorage.getItem('nova_recent_projects') || '[]');
        setRecentProjects(recent);
      } catch (e) {}
    }, 2000);
    return () => clearInterval(int);
  }, []);

  return (
    <div className="w-[60px] md:w-[220px] h-full border-r border-slate-800 bg-slate-950 flex flex-col shrink-0 transition-all duration-300">
      <div className="p-3 border-b border-slate-800 hidden md:block">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Recent</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <button className="w-full flex items-center justify-center md:justify-start gap-3 p-2 rounded bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 transition-colors group">
          <Plus className="w-4 h-4 shrink-0" />
          <span className="text-xs font-bold hidden md:block">New Project</span>
        </button>
        
        <button className="w-full flex items-center justify-center md:justify-start gap-3 p-2 rounded text-slate-400 hover:bg-slate-900 transition-colors">
          <Download className="w-4 h-4 shrink-0" />
          <span className="text-xs font-bold hidden md:block">Import Local</span>
        </button>
        
        <div className="pt-4 pb-1 hidden md:block">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-2">History</span>
        </div>
        
        {recentProjects.length > 0 ? recentProjects.map((proj, i) => (
          <button key={i} className={`w-full flex items-center justify-center md:justify-start gap-3 p-2 rounded ${i === 0 ? 'bg-slate-800/50 text-slate-200 border-l-2 border-indigo-500' : 'text-slate-400 hover:bg-slate-900'}`}>
            <FolderGit2 className={`w-4 h-4 shrink-0 ${i === 0 ? 'text-indigo-400' : ''}`} />
            <div className="hidden md:flex flex-col items-start truncate w-full">
              <span className="text-xs font-bold truncate w-full text-left">{proj.name}</span>
              <span className="text-[9px] text-slate-500">{proj.mode}</span>
            </div>
          </button>
        )) : (
          <button className="w-full flex items-center justify-center md:justify-start gap-3 p-2 rounded bg-slate-800/50 text-slate-200 border-l-2 border-indigo-500">
            <FolderGit2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <div className="hidden md:flex flex-col items-start truncate">
              <span className="text-xs font-bold truncate">NovaAI E-Commerce</span>
              <span className="text-[9px] text-slate-500">Next.js App Router</span>
            </div>
          </button>
        )}
      </div>
      
      <div className="p-3 border-t border-slate-800 hidden md:flex items-center gap-2 text-[10px] text-slate-500">
        <Clock className="w-3 h-3" /> Last saved: {recentProjects.length > 0 ? new Date(recentProjects[0].time).toLocaleTimeString() : 'just now'}
      </div>
    </div>
  );
}

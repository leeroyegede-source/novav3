import React, { useEffect, useState } from 'react';
import { ProjectMemory } from '@/lib/memory/projectMemory';
import { VersionManager } from '@/lib/memory/versionManager';
import { Save, Play, CheckCircle2, AlertTriangle, Cloud, RotateCcw, LayoutPanelLeft, PanelBottom, Settings2, History, GitBranch, FastForward, MoreHorizontal, Trash2, DownloadCloud, Copy, X, Loader2, ShieldCheck } from 'lucide-react';
import { DebugPanel } from '@/components/editor/DebugPanel';

interface BuilderTopBarProps {
  onToggleRight: () => void;
  onToggleBottom: () => void;
  onOpenVersions: () => void;
  appMode: string;
  setAppMode: (mode: string) => void;
  userEmail?: string;
  onLoadProject: (projId: string) => void;
  onDeleteProject: (projId: string) => void;
  onClearRecent: () => void;
  theme: string;
  setTheme: (t: string) => void;
}

export function BuilderTopBar({ onToggleRight, onToggleBottom, onOpenVersions, appMode, setAppMode, userEmail, onLoadProject, onDeleteProject, onClearRecent, theme, setTheme }: BuilderTopBarProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [memory, setMemory] = useState<any>(null);
  const [recentOpen, setRecentOpen] = useState(false);
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [timeline, setTimeline] = useState({ max: 0, current: 0 });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [aiModel, setAiModel] = useState('default');
  const [showKeyPopover, setShowKeyPopover] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const [keyStatus, setKeyStatus] = useState<'idle' | 'verifying' | 'verified' | 'error'>('idle');
  const [pendingModel, setPendingModel] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedModel = localStorage.getItem('nova_ai_model') || 'default';
      setAiModel(savedModel);
      if (savedModel !== 'default') {
         const storedKey = localStorage.getItem(`nova_api_key_${savedModel}`) || '';
         setKeyStatus(storedKey ? 'verified' : 'idle');
      }
    }
  }, []);

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'default') {
      setAiModel(val);
      localStorage.setItem('nova_ai_model', val);
      setShowKeyPopover(false);
      setPendingModel('');
    } else {
      setPendingModel(val);
      const storedKey = localStorage.getItem(`nova_api_key_${val}`) || '';
      setTempKey(storedKey);
      setKeyStatus('idle');
      setShowKeyPopover(true);
    }
  };

  const handleVerifyKey = async () => {
    if (!tempKey.trim() || !pendingModel) return;
    setKeyStatus('verifying');
    
    try {
      let isValid = false;
      if (pendingModel === 'openai') {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${tempKey}` }
        });
        isValid = res.ok;
      } else if (pendingModel.includes('gemini')) {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${tempKey}`);
        isValid = res.ok;
      }

      if (isValid) {
        localStorage.setItem(`nova_api_key_${pendingModel}`, tempKey);
        localStorage.setItem('nova_ai_model', pendingModel);
        setAiModel(pendingModel);
        setKeyStatus('verified');
        setTimeout(() => {
          setShowKeyPopover(false);
          setPendingModel('');
        }, 1500);
      } else {
        setKeyStatus('error');
      }
    } catch (e) {
      setKeyStatus('error');
    }
  };

  const closePopover = () => {
    setShowKeyPopover(false);
    setPendingModel('');
    setKeyStatus(aiModel !== 'default' ? 'verified' : 'idle');
  };

  const handleCopyId = () => {
    if (memory?.project_id) {
      navigator.clipboard.writeText(memory.project_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    const handleUpdate = (e: any) => setTimeline(e.detail);
    window.addEventListener('nova-timeline-update', handleUpdate);
    return () => window.removeEventListener('nova-timeline-update', handleUpdate);
  }, []);

  useEffect(() => {
    setIsHydrated(true);
    setMemory(ProjectMemory.getMemory());
    const int = setInterval(() => setMemory(ProjectMemory.getMemory()), 3000);
    return () => clearInterval(int);
  }, []);

  useEffect(() => {
    const fetchRecent = () => {
      try {
        const recent = JSON.parse(localStorage.getItem('nova_recent_projects') || '[]');
        setRecentProjects(recent);
      } catch (e) {}
    };
    fetchRecent();
    window.addEventListener('nova-recent-updated', fetchRecent);
    return () => window.removeEventListener('nova-recent-updated', fetchRecent);
  }, [recentOpen]);

  const handleLoadProject = (projId: string) => {
    onLoadProject(projId);
    setRecentOpen(false);
  };

  const isStable = isHydrated && memory ? !!memory.last_stable_version_id : false;
  const isFailed = isHydrated && memory ? !!memory.last_failed_version_id : false;

  return (
    <div className="h-12 w-full min-w-0 max-w-full border-b border-white/5 bg-white/[0.02] backdrop-blur-xl flex items-center justify-between px-2 md:px-4 select-none shrink-0 z-[100] relative">
      <div className="flex items-center gap-2 md:gap-4 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="text-white font-bold text-[10px]">NV</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-bold text-slate-200 leading-tight hidden md:block truncate">Nova Workspace</h1>
            <h1 className="text-xs font-bold text-slate-200 leading-tight md:hidden truncate">NOVA</h1>
          </div>
        </div>

        {userEmail && (
          <div className="hidden md:flex items-center gap-2 ml-4">
            <span className="text-[10px] text-slate-400 border border-slate-700 bg-slate-800 px-2 py-0.5 rounded-full">{userEmail}</span>
            <button 
              onClick={async () => {
                const { supabase } = await import('@/lib/supabaseClient');
                await supabase.auth.signOut();
                window.location.href = '/login';
              }}
              className="text-[10px] text-slate-400 hover:text-white transition-colors"
            >
              Logout
            </button>
          </div>
        )}

        <div className="relative ml-2 md:ml-4 hidden md:block">
          <button onClick={() => setRecentOpen(!recentOpen)} className="text-[10px] font-bold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded transition-colors flex items-center gap-1.5">
             <History className="w-3 h-3" /> Recent
          </button>
          
          {recentOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
               <div className="p-2 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
                 <span className="text-[10px] font-bold text-slate-500 uppercase">Recent Projects</span>
                 {recentProjects.length > 0 && (
                   <button onClick={onClearRecent} className="text-[9px] text-slate-500 hover:text-rose-400 transition-colors">Clear All</button>
                 )}
               </div>
               <div className="max-h-[300px] overflow-y-auto p-1">
                 {recentProjects.length > 0 ? recentProjects.map((p, i) => (
                   <div key={i} className="flex items-center gap-1 mb-1">
                     <button onClick={() => handleLoadProject(p.id)} className="flex-1 text-left p-2 rounded hover:bg-slate-800 transition-colors flex flex-col gap-1">
                       <span className="text-xs font-bold text-slate-200">{p.name}</span>
                       <div className="flex items-center justify-between">
                         <span className="text-[9px] text-slate-500">{p.mode}</span>
                         <span className="text-[9px] text-indigo-400">Saved</span>
                       </div>
                     </button>
                     <button onClick={() => onDeleteProject(p.id)} className="p-2 text-slate-600 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors" title="Delete Project">
                       <Trash2 className="w-3.5 h-3.5" />
                     </button>
                   </div>
                 )) : (
                   <div className="p-4 text-center text-[10px] text-slate-500">No recent projects yet.</div>
                 )}
               </div>
            </div>
          )}
        </div>
        
        <div className="hidden md:block h-4 w-px bg-slate-800 mx-2" />
        
        <div className="hidden md:flex items-center gap-3 text-[10px] font-bold text-slate-400">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${isStable ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}`} />
            Stable
          </div>
          <div className="flex items-center gap-1.5">
             {isFailed ? <AlertTriangle className="w-3 h-3 text-rose-500" /> : <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
             Tests
          </div>
          
          <DebugPanel />
          
          <select 
              value={appMode} 
              onChange={(e) => setAppMode(e.target.value)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700 rounded px-2 py-1 outline-none cursor-pointer transition-colors"
          >
              {["Auto Detect", "React / Vite", "Next.js", "Node / Express", "PHP", "Laravel", "Static Website", "API Only"].map(m => (
                <option key={m} value={m} className="bg-slate-900">{m}</option>
              ))}
          </select>
          
          <select 
              value={theme} 
              onChange={(e) => setTheme(e.target.value)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700 rounded px-2 py-1 outline-none cursor-pointer transition-colors"
          >
              <option value="godlike" className="bg-slate-900">God-Tier Theme</option>
              <option value="night" className="bg-slate-900">Night Mode</option>
              <option value="day" className="bg-slate-900">Vibrant Mode</option>
          </select>
        </div>
        
        <div className="md:hidden flex items-center ml-2">
           <span className="text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300 px-2 py-1 rounded truncate max-w-[100px]">{appMode}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-auto pl-2">
        <div className="relative">
          <select 
              value={pendingModel || aiModel} 
              onChange={handleModelChange}
              className={`hidden md:flex text-[10px] font-bold px-2 py-1.5 rounded outline-none cursor-pointer transition-colors shrink-0 shadow-[0_0_10px_rgba(99,102,241,0.1)] ${aiModel !== 'default' && !pendingModel ? 'bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-500/30 text-emerald-200' : 'bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-500/30 text-indigo-200'}`}
          >
              <option value="default" className="bg-slate-900 text-slate-200">🤖 Claude (Default)</option>
              <option value="openai" className="bg-slate-900 text-slate-200">🧠 GPT-4o</option>
              <option value="gemini-pro" className="bg-slate-900 text-slate-200">💎 Gemini Pro</option>
              <option value="gemini-free" className="bg-slate-900 text-slate-200">⚡ Gemini Free</option>
          </select>
          
          {showKeyPopover && (
             <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center mb-2">
                   <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-indigo-400" /> Bring Your Own Key</span>
                   <button onClick={closePopover} className="text-slate-500 hover:text-slate-300"><X className="w-3 h-3" /></button>
                </div>
                <input 
                   type="password"
                   value={tempKey}
                   onChange={(e) => {
                     setTempKey(e.target.value);
                     setKeyStatus('idle');
                   }}
                   placeholder={`Enter ${pendingModel || aiModel} API Key...`}
                   className={`w-full bg-slate-950 border ${keyStatus === 'error' ? 'border-red-500/50 text-red-300' : 'border-slate-800 text-slate-300'} text-[10px] p-1.5 rounded outline-none focus:border-indigo-500 transition-colors mb-2`}
                />
                <button 
                   onClick={handleVerifyKey}
                   disabled={!tempKey || keyStatus === 'verifying'}
                   className={`w-full flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded transition-colors ${keyStatus === 'verified' ? 'bg-emerald-600 text-white' : keyStatus === 'error' ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50'}`}
                >
                   {keyStatus === 'verifying' ? <Loader2 className="w-3 h-3 animate-spin" /> : keyStatus === 'verified' ? <CheckCircle2 className="w-3 h-3" /> : keyStatus === 'error' ? <AlertTriangle className="w-3 h-3" /> : null}
                   {keyStatus === 'verifying' ? 'Verifying...' : keyStatus === 'verified' ? 'Active & Verified' : keyStatus === 'error' ? 'Invalid Key - Retry' : 'Verify & Save Key'}
                </button>
             </div>
          )}
        </div>
        <button onClick={onOpenVersions} className="hidden md:flex text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded items-center gap-1.5 transition-colors shrink-0">
          <GitBranch className="w-3 h-3" /> Versions
        </button>
        {memory?.project_id && (
          <button onClick={handleCopyId} className="hidden md:flex text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded items-center gap-1.5 transition-colors shrink-0">
            {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied ID!' : 'Copy ID'}
          </button>
        )}
        <a href="/api/sync/cli" download="nova-sync.js" className="hidden md:flex text-[10px] font-bold bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 px-3 py-1.5 rounded items-center gap-1.5 transition-colors shrink-0 shadow-[0_0_10px_rgba(99,102,241,0.2)]">
          <DownloadCloud className="w-3 h-3" /> Local Sync CLI
        </a>
        {timeline.max > 0 && (
          <div className="hidden md:flex items-center gap-2 bg-slate-800 px-2 py-1 rounded h-7 border border-slate-700" title="Time-Travel Debugger">
            <History className="w-3 h-3 text-indigo-400" />
            <input 
              type="range" 
              min="0" 
              max={timeline.max} 
              value={timeline.current}
              onChange={(e) => {
                const idx = parseInt(e.target.value);
                setTimeline(prev => ({ ...prev, current: idx }));
                window.dispatchEvent(new CustomEvent('nova-time-travel', { detail: idx }));
              }}
              className="w-16 h-1 bg-slate-900 rounded-lg appearance-none cursor-ew-resize accent-indigo-500"
            />
            <span className="text-[9px] font-mono text-slate-400">v{timeline.current}</span>
          </div>
        )}
        
        <div className="hidden md:block h-4 w-px bg-slate-800 mx-2" />
        
        <button onClick={onToggleBottom} className="hidden md:block p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors" title="Toggle Bottom Panel">
          <PanelBottom className="w-4 h-4" />
        </button>
        <button onClick={onToggleRight} className="hidden md:block p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors" title="Toggle Right Panel">
          <Settings2 className="w-4 h-4" />
        </button>
        
        <div className="relative md:hidden">
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800 rounded">
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {mobileMenuOpen && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 p-2 flex flex-col gap-2">
              {userEmail && (
                <div className="border-b border-slate-800 pb-2 mb-1 flex flex-col gap-1">
                  <span className="text-[10px] text-slate-400 truncate">{userEmail}</span>
                  <button 
                    onClick={async () => {
                      const { supabase } = await import('@/lib/supabaseClient');
                      await supabase.auth.signOut();
                      window.location.href = '/login';
                    }}
                    className="text-[10px] text-left text-slate-300 hover:text-white"
                  >
                    Logout
                  </button>
                </div>
              )}
              <button onClick={() => { setRecentOpen(!recentOpen); setMobileMenuOpen(false); }} className="text-left text-xs font-bold text-slate-300 flex items-center gap-2">
                 <History className="w-3 h-3" /> Recent Projects
              </button>
              <button onClick={() => { onOpenVersions(); setMobileMenuOpen(false); }} className="text-left text-xs font-bold text-slate-300 flex items-center gap-2">
                 <GitBranch className="w-3 h-3" /> Versions
              </button>
              <div className="border-t border-slate-800 pt-2 mt-1">
                <select 
                    value={appMode} 
                    onChange={(e) => setAppMode(e.target.value)}
                    className="w-full bg-slate-800 text-slate-200 text-[11px] font-bold border border-slate-700 rounded px-2 py-1 outline-none mb-2"
                >
                    {["Auto Detect", "React / Vite", "Next.js", "Node / Express", "PHP", "Laravel", "Static Website", "API Only"].map(m => (
                      <option key={m} value={m} className="bg-slate-900">{m}</option>
                    ))}
                </select>
                <select 
                    value={theme} 
                    onChange={(e) => setTheme(e.target.value)}
                    className="w-full bg-slate-800 text-slate-200 text-[11px] font-bold border border-slate-700 rounded px-2 py-1 outline-none"
                >
                    <option value="godlike" className="bg-slate-900">God-Tier Theme</option>
                    <option value="night" className="bg-slate-900">Night Mode</option>
                    <option value="day" className="bg-slate-900">Vibrant Mode</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Mobile Recent Drawer */}
      {recentOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm md:hidden flex flex-col justify-end">
          <div className="bg-slate-900 border-t border-slate-800 rounded-t-xl max-h-[80vh] flex flex-col overflow-hidden shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
               <span className="text-sm font-bold text-slate-300 flex items-center gap-2"><History className="w-4 h-4" /> Recent Projects</span>
               <div className="flex items-center gap-4">
                 {recentProjects.length > 0 && (
                   <button onClick={onClearRecent} className="text-xs text-slate-500 hover:text-rose-400 transition-colors">Clear All</button>
                 )}
                 <button onClick={() => setRecentOpen(false)} className="text-slate-500 hover:text-slate-300 p-1">Close</button>
               </div>
            </div>
            <div className="overflow-y-auto p-2">
               {recentProjects.length > 0 ? recentProjects.map((p, i) => (
                 <div key={i} className="flex items-center gap-2 mb-2">
                   <button onClick={() => handleLoadProject(p.id)} className="flex-1 text-left p-3 rounded-lg hover:bg-slate-800 transition-colors flex flex-col gap-1 border border-slate-800/50">
                     <span className="text-sm font-bold text-slate-200">{p.name}</span>
                     <div className="flex items-center justify-between mt-1">
                       <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded">{p.mode}</span>
                       <span className="text-[10px] text-indigo-400">Saved locally</span>
                     </div>
                   </button>
                   <button onClick={() => onDeleteProject(p.id)} className="p-3 bg-slate-900 border border-slate-800/50 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors" title="Delete Project">
                     <Trash2 className="w-4 h-4" />
                   </button>
                 </div>
               )) : (
                 <div className="p-6 text-center text-xs text-slate-500">No recent projects yet.</div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

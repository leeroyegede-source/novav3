import React, { useEffect, useState } from 'react';
import { ProjectMemoryState, ProjectMemory } from '@/lib/memory/projectMemory';
import { CheckCircle2, CircleDashed, Loader2, AlertTriangle, X, Play, Minimize2, Maximize2, ShieldCheck, Activity, Terminal } from 'lucide-react';

type AgentStageStatus = "pending" | "running" | "completed" | "failed" | "recovery";

export type AgentStage = {
  id: string | number;
  task: string;
  status: AgentStageStatus;
};

export function AgentProgressOverlay() {
  const [stages, setStages] = useState<AgentStage[]>([]);
  const [pendingStages, setPendingStages] = useState<any[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [aiProvider, setAiProvider] = useState("AI Active");
  const [recentLogs, setRecentLogs] = useState<string[]>([]);
  const [lastCheckpoint, setLastCheckpoint] = useState<string | null>(null);

  useEffect(() => {
    const memory = ProjectMemory.getMemory();
    updateFromMemory(memory);

    const handleMemoryUpdate = (e: any) => {
      updateFromMemory(e.detail as ProjectMemoryState);
    };
    
    const handleLogUpdate = (e: any) => {
      if (e.detail && typeof e.detail === 'string') {
        setRecentLogs(prev => {
           const newLogs = [...prev, e.detail].slice(-3); // Keep last 3 logs
           
           // Auto-detect recovery / compile states from logs
           if (e.detail.includes('Auto-Heal') || e.detail.includes('recovery')) {
             setIsRecovery(true);
           }
           if (e.detail.includes('Snapshot saved') || e.detail.includes('Stable Checkpoint')) {
             setLastCheckpoint(new Date().toLocaleTimeString());
           }
           
           return newLogs;
        });
      }
    };

    window.addEventListener('nova-memory-update', handleMemoryUpdate);
    window.addEventListener('nova-agent-log', handleLogUpdate);
    return () => {
      window.removeEventListener('nova-memory-update', handleMemoryUpdate);
      window.removeEventListener('nova-agent-log', handleLogUpdate);
    };
  }, []);

  const updateFromMemory = (memory: ProjectMemoryState) => {
    if (!memory.full_plan || memory.full_plan.length === 0) {
      if (!isComplete) {
        setIsVisible(false);
      }
      return;
    }

    const fullPlan = memory.full_plan;
    const pendingPlan = memory.pending_plan || [];
    
    if (fullPlan.length > 0 && pendingPlan.length === 0) {
      const allCompleted = fullPlan.map(s => ({ id: s.stage, task: s.task, status: "completed" as AgentStageStatus }));
      setStages(allCompleted);
      setIsComplete(true);
      setHasError(false);
      setIsRecovery(false);
      setLastCheckpoint(new Date().toLocaleTimeString());
      
      setTimeout(() => {
        setIsVisible(false);
        setIsComplete(false);
      }, 5000);
      return;
    }

    const newStages: AgentStage[] = fullPlan.map(fp => {
      const isPending = pendingPlan.some(p => p.stage === fp.stage);
      if (!isPending) return { id: fp.stage, task: fp.task, status: "completed" };
      return { id: fp.stage, task: fp.task, status: "pending" };
    });

    const hasCriticalError = memory.items.some(i => i.type === 'error' && i.importance === 'critical');
    
    if (hasCriticalError) {
       setHasError(true);
       setIsRecovery(false);
       const firstPending = newStages.find(s => s.status === 'pending');
       if (firstPending) firstPending.status = 'failed';
    } else {
       setHasError(false);
       // If in recovery, mark first pending as recovery
       if (isRecovery) {
         const firstPending = newStages.find(s => s.status === 'pending');
         if (firstPending) firstPending.status = 'recovery';
       }
    }

    setStages(newStages);
    setPendingStages(pendingPlan);
    
    // Set AI Provider based on memory if available, else default
    if (memory.project_mode) {
      setAiProvider(`Context Compressed (${memory.project_mode})`);
    }
    
    setIsVisible(true);
  };

  const handleResume = () => {
    window.dispatchEvent(new CustomEvent('nova-resume-execution'));
    setStages(prev => {
      const next = [...prev];
      const firstPendingIndex = next.findIndex(s => s.status === 'pending' || s.status === 'failed' || s.status === 'recovery');
      if (firstPendingIndex !== -1) {
        next[firstPendingIndex].status = 'running';
      }
      return next;
    });
    setHasError(false);
    setIsRecovery(false);
  };

  if (!isVisible) return null;

  const completedCount = stages.filter(s => s.status === 'completed').length;
  const totalCount = stages.length;
  const progressPercent = totalCount === 0 ? 0 : (completedCount / totalCount) * 100;

  // Color theme selection based on state
  let themeColor = "indigo";
  let themeGradient = "from-indigo-500 to-cyan-400";
  let themeBorder = "border-slate-700/50 shadow-indigo-500/10";
  let statusText = "Processing";
  
  if (isComplete) {
    themeColor = "emerald";
    themeGradient = "from-emerald-500 to-teal-400";
    themeBorder = "border-emerald-500/30 shadow-emerald-500/20";
    statusText = "Build Stable";
  } else if (hasError) {
    themeColor = "rose";
    themeGradient = "from-rose-500 to-red-400";
    themeBorder = "border-rose-500/50 shadow-[0_0_30px_rgba(244,63,94,0.15)]";
    statusText = "Critical Failure";
  } else if (isRecovery) {
    themeColor = "amber";
    themeGradient = "from-amber-500 to-orange-400";
    themeBorder = "border-amber-500/50 shadow-amber-500/20";
    statusText = "Attempting Recovery";
  }

  return (
    <div className="fixed top-6 right-6 z-[9999] transition-all duration-500 ease-out font-sans">
      <div className={`backdrop-blur-3xl bg-slate-900/95 border ${themeBorder} rounded-2xl overflow-hidden shadow-2xl transition-all duration-500 ${isMinimized ? 'w-72' : 'w-96'}`}>
        
        {/* Progress Bar Top */}
        <div className="h-1.5 w-full bg-slate-800/50 relative overflow-hidden">
          <div 
            className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-in-out bg-gradient-to-r ${themeGradient}`} 
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-white/5 bg-white/[0.02]">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Activity className={`w-3.5 h-3.5 text-${themeColor}-400 ${!isComplete && !hasError ? 'animate-pulse' : ''}`} />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {statusText}
              </span>
            </div>
            <span className="text-sm font-semibold text-slate-100 flex items-center gap-2 mt-0.5">
              {isComplete ? 'All Stages Complete' : `Stage ${completedCount + 1} of ${totalCount}`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 text-slate-400 hover:text-indigo-300 transition-colors rounded-lg hover:bg-white/5">
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setIsVisible(false)} className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors rounded-lg hover:bg-white/5">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        {!isMinimized && (
          <div className="p-3 flex flex-col gap-3">
            
            {/* Status Badges */}
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 border border-slate-700/50 rounded-md shrink-0">
                <ShieldCheck className="w-3 h-3 text-indigo-400" />
                <span className="text-[10px] font-medium text-slate-300">{aiProvider}</span>
              </div>
              {lastCheckpoint && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] font-medium text-emerald-300">Stable Checkpoint Saved</span>
                </div>
              )}
            </div>

            {/* Stages List */}
            <div className="space-y-1.5 max-h-[25vh] overflow-y-auto custom-scrollbar pr-1">
              {stages.map((stage) => (
                <div key={stage.id} className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${stage.status === 'running' ? 'bg-indigo-500/10 border border-indigo-500/20' : stage.status === 'recovery' ? 'bg-amber-500/10 border border-amber-500/20' : stage.status === 'failed' ? 'bg-rose-500/10 border border-rose-500/20' : 'hover:bg-white/5 border border-transparent'}`}>
                  <div className="mt-0.5 shrink-0">
                    {stage.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    {stage.status === 'pending' && <CircleDashed className="w-4 h-4 text-slate-600" />}
                    {stage.status === 'running' && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
                    {stage.status === 'recovery' && <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />}
                    {stage.status === 'failed' && <X className="w-4 h-4 text-rose-400" />}
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className={`text-xs font-medium ${stage.status === 'completed' ? 'text-slate-400 line-through' : stage.status === 'failed' ? 'text-rose-300' : stage.status === 'recovery' ? 'text-amber-300' : stage.status === 'running' ? 'text-indigo-200' : 'text-slate-300'}`}>
                      {stage.task}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Mini Terminal Feed */}
            <div className="mt-2 bg-black/40 border border-slate-800 rounded-lg p-2 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 mb-1">
                <Terminal className="w-3 h-3 text-slate-500" />
                <span className="text-[9px] font-bold text-slate-500 uppercase">Activity Log</span>
              </div>
              {recentLogs.length > 0 ? (
                recentLogs.map((log, i) => (
                  <div key={i} className="text-[10px] text-slate-400 font-mono truncate">
                    &gt; {log.replace('[SYSTEM]', '').trim()}
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-slate-600 font-mono italic">&gt; Waiting for compiler...</div>
              )}
            </div>

            {/* Actions */}
            {hasError && (
              <div className="mt-1 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex flex-col gap-2">
                <span className="text-[11px] text-rose-300 font-medium">Recovery failed or credit exhausted. Rollback available.</span>
                <button 
                  onClick={handleResume}
                  className="flex items-center justify-center gap-2 w-full py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-rose-500/20"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Force Resume
                </button>
              </div>
            )}
            
            {isRecovery && !hasError && (
              <div className="mt-1 p-2 border border-amber-500/20 bg-amber-500/5 rounded-lg">
                <span className="text-[11px] text-amber-400 font-medium flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Attempting auto-heal...
                </span>
              </div>
            )}
            
            {!hasError && !isComplete && !isRecovery && pendingStages.length > 0 && stages.find(s => s.status === 'pending') && (
              <div className="mt-1">
                <button 
                  onClick={handleResume}
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg transition-all shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_25px_rgba(99,102,241,0.3)]"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Save Checkpoint & Continue
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { Send, StopCircle, Undo2, BrainCircuit, Image as ImageIcon, X, History, Trash2, Database, Palette, Code, ShieldCheck } from 'lucide-react';
import { VersionManager } from '@/lib/memory/versionManager';
import { ProjectMemory } from '@/lib/memory/projectMemory';
import { LocalDB, STORE_CHAT } from '@/lib/storage/indexedDB';

export function ChatPanel({ files, setFiles, setLogs, clearChatTrigger, reloadChatTrigger, appMode, onVerifyCompile }: { files: Record<string, string>, setFiles: (f: Record<string, string>) => void, setLogs: (cb: (prev: string[]) => string[]) => void, clearChatTrigger?: number, reloadChatTrigger?: number, appMode?: string, onVerifyCompile?: (files: Record<string, string>) => Promise<{success: boolean, files?: Record<string, string>}> }) {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<{role: string, content: string, reasoning?: string, image?: string}[]>([{ role: 'agent', content: "Welcome to NovaAI! Describe the app you want to build or drop a design screenshot."}]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<Record<string, string>[]>([files]);
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hiddenSubmitRef = useRef<HTMLButtonElement>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const handleSetPrompt = (e: any) => {
      setPrompt(prev => prev ? prev + ' ' + e.detail : e.detail);
      setTimeout(() => chatInputRef.current?.focus(), 50);
    };
    const handleResume = () => {
      setPrompt("continue");
      setTimeout(() => hiddenSubmitRef.current?.click(), 50);
    };
    window.addEventListener('nova-set-prompt', handleSetPrompt);
    window.addEventListener('nova-resume-execution', handleResume);
    return () => {
      window.removeEventListener('nova-set-prompt', handleSetPrompt);
      window.removeEventListener('nova-resume-execution', handleResume);
    };
  }, []);

  useEffect(() => {
    const initStorage = async () => {
      let savedMsgs = null;
      let savedHistory = null;
      try {
        savedMsgs = await LocalDB.get<any[]>(STORE_CHAT, 'nova_messages');
        savedHistory = await LocalDB.get<Record<string, string>[]>(STORE_CHAT, 'nova_history');
      } catch (e) {
        console.error("LocalDB Error in ChatPanel:", e);
      }

      const lsMsgs = localStorage.getItem('nova_messages');
      const lsHistory = localStorage.getItem('nova_history');

      if (savedMsgs) {
        setMessages(savedMsgs);
      } else if (lsMsgs) {
        try { 
          const m = JSON.parse(lsMsgs);
          setMessages(m);
          await LocalDB.set(STORE_CHAT, 'nova_messages', m);
        } catch (e) {}
      }

      if (savedHistory) {
        setHistory(savedHistory);
        setTimelineIndex(savedHistory.length - 1);
      } else if (lsHistory) {
        try { 
          const parsedHistory = JSON.parse(lsHistory);
          setHistory(parsedHistory);
          setTimelineIndex(parsedHistory.length - 1);
          await LocalDB.set(STORE_CHAT, 'nova_history', parsedHistory);
        } catch (e) {}
      }
      setIsHydrated(true);
    };
    initStorage();
  }, []);

  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem('nova_messages', JSON.stringify(messages));
      } catch (e) {
        console.warn("localStorage quota exceeded for messages, relying on IndexedDB.");
      }
      try {
        localStorage.setItem('nova_history', JSON.stringify(history));
      } catch (e) {
        console.warn("localStorage quota exceeded for history, relying on IndexedDB.");
      }
      LocalDB.set(STORE_CHAT, 'nova_messages', messages).catch(console.error);
      LocalDB.set(STORE_CHAT, 'nova_history', history).catch(console.error);
    }
  }, [messages, history, isHydrated]);

  useEffect(() => {
    if (clearChatTrigger && clearChatTrigger > 0) {
      setMessages([{ role: 'agent', content: "Welcome to NovaAI! Describe the app you want to build or drop a design screenshot."}]);
      setHistory([files]);
      setTimelineIndex(0);
      setLogs(prev => [...prev, "[SYSTEM] Chat history and snapshots cleared."]);
      LocalDB.remove(STORE_CHAT, 'nova_messages').catch(console.error);
      LocalDB.remove(STORE_CHAT, 'nova_history').catch(console.error);
      localStorage.removeItem('nova_messages');
      localStorage.removeItem('nova_history');
    }
  }, [clearChatTrigger]);

  useEffect(() => {
    if (reloadChatTrigger && reloadChatTrigger > 0) {
      const reloadStorage = async () => {
        try {
          const savedMsgs = await LocalDB.get<any[]>(STORE_CHAT, 'nova_messages');
          const savedHistory = await LocalDB.get<Record<string, string>[]>(STORE_CHAT, 'nova_history');
          
          if (savedMsgs) setMessages(savedMsgs);
          else setMessages([{ role: 'agent', content: "Welcome to NovaAI! Describe the app you want to build or drop a design screenshot."}]);

          if (savedHistory) {
            setHistory(savedHistory);
            setTimelineIndex(savedHistory.length - 1);
          } else {
            setHistory([files]);
            setTimelineIndex(0);
          }
        } catch (e) {
          console.error("LocalDB Reload Error:", e);
        }
      };
      reloadStorage();
    }
  }, [reloadChatTrigger]);

  useEffect(() => {
    const handleScrubExternal = (e: any) => {
      const idx = e.detail;
      if (idx >= 0 && idx < history.length) {
        setTimelineIndex(idx);
        setFiles(history[idx]);
        setLogs(prev => [...prev, `[DEBUG] Time-Travel: Restored snapshot v${idx}`]);
      }
    };
    window.addEventListener('nova-time-travel', handleScrubExternal);
    
    // Broadcast current state
    const event = new CustomEvent('nova-timeline-update', { 
      detail: { max: history.length - 1, current: timelineIndex } 
    });
    window.dispatchEvent(event);

    return () => window.removeEventListener('nova-time-travel', handleScrubExternal);
  }, [history, timelineIndex, setFiles, setLogs]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    
    const userMsg = prompt;
    const currentImage = attachedImage;
    setPrompt("");
    setAttachedImage(null);
    setMessages(prev => [...prev, { role: 'user', content: userMsg, image: currentImage || undefined }]);
    setIsGenerating(true);
    setLogs(prev => [...prev, `[SYSTEM] Processing request with Vision Agent...`]);
    
    abortControllerRef.current = new AbortController();
    
    try {
      // Check if current files are just the demo boilerplate
      const isDemo = Object.keys(files).length <= 4 && Object.values(files).some(content => content.includes("Hello ") && content.includes("from NovaAI"));
      
      const wipeExisting = false;
      const filesToSend = isDemo ? {} : files;
      
      if (isDemo) {
         setLogs(prev => [...prev, `[SYSTEM] Wiping demo boilerplate for clean generation...`]);
      }

      const conversationHistory = messages.map(m => ({ role: m.role, content: m.content }));
      const memoryState = ProjectMemory.getMemory();
      
      const aiModel = localStorage.getItem('nova_ai_model') || 'default';
      const apiKey = aiModel !== 'default' ? (localStorage.getItem(`nova_api_key_${aiModel}`) || '') : '';
      
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: userMsg, 
          currentFiles: filesToSend, 
          imageBase64: currentImage,
          history: conversationHistory,
          appMode: appMode,
          memory: memoryState,
          aiModel,
          apiKey
        }),
        signal: abortControllerRef.current.signal
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${res.status}`);
      }
      
      const data = await res.json();
      
      // Move pending plan save to the end to prevent race condition with Auto-Heal
      if (data.buildState !== undefined) {
        ProjectMemory.updateBuildState(data.buildState);
      }

      if (data.files) {
        const newFiles = (isDemo || wipeExisting) ? data.files : { ...files, ...data.files };
        
        // Save the temp snapshot just in case we need a deep rollback
        VersionManager.saveSnapshot(files, `Pre-AI (Temp Snapshot)`);
        
        let filesToApply = newFiles;

        if (onVerifyCompile) {
           const verifyResult = await onVerifyCompile(newFiles);
           if (!verifyResult.success) {
              setLogs(prev => [...prev, `[SYSTEM] Compile check failed permanently after Auto-Heal. Halting execution.`]);
              setFiles(verifyResult.files || files); // Rollback
              setIsGenerating(false);
              return; // Do NOT save pending plan, DO NOT unlock UI
           } else if (verifyResult.files) {
              filesToApply = verifyResult.files; // Use fixed files if auto-heal succeeded
           }
        }
        
        setHistory(prev => {
          const newHistory = prev.slice(0, timelineIndex + 1);
          newHistory.push(filesToApply);
          return newHistory;
        });
        VersionManager.saveSnapshot(filesToApply, `AI Agent: ${userMsg}`);
        ProjectMemory.addItem({
          type: 'todo',
          title: `AI Task Complete`,
          content: `Executed user request: ${userMsg}`,
          importance: 'medium'
        });
        setTimelineIndex(prev => prev + 1);
        setFiles(filesToApply);
        setLogs(prev => [...prev, `[SYSTEM] Applied file operations. Snapshot & Memory saved.`]);
        
        // NOW we unlock the Progress Overlay by saving the pending plan
        if (data.structuredResponse?.pendingPlan !== undefined) {
          ProjectMemory.savePendingPlan(data.structuredResponse.pendingPlan, data.structuredResponse.fullPlan);
        }
      }
      if (data.message) {
        setMessages(prev => [...prev, { 
          role: 'agent', 
          content: data.message, 
          reasoning: data.reasoning,
          structuredResponse: data.structuredResponse 
        }]);
      }
    } catch (error: unknown) {
      if ((error as Error).name === 'AbortError') {
        setMessages(prev => [...prev, { role: 'agent', content: "Generation stopped by user." }]);
        setLogs(prev => [...prev, "[SYSTEM] Request aborted by user."]);
      } else {
        const err = error as Error;
        setMessages(prev => [...prev, { role: 'agent', content: "Generation failed: " + err.message }]);
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value);
    setTimelineIndex(idx);
    setFiles(history[idx]);
    setLogs(prev => [...prev, `[DEBUG] Time-Travel: Restored snapshot v${idx}`]);
  };

  const handleClearChat = () => {
    setMessages([{ role: 'agent', content: "Welcome to NovaAI! Describe the app you want to build or drop a design screenshot."}]);
    setHistory([files]);
    setTimelineIndex(0);
    setLogs(prev => [...prev, "[SYSTEM] Chat history and snapshots cleared."]);
  };



  const [progressMsg, setProgressMsg] = useState("Initializing...");
  useEffect(() => {
    if (isGenerating) {
      const msgs = ["Reading project memory...", "Creating snapshot...", "Inspecting files...", "Applying changes...", "Running tests...", "Validating runner..."];
      let i = 0;
      setProgressMsg(msgs[0]);
      const intv = setInterval(() => {
        i = (i + 1) % msgs.length;
        setProgressMsg(msgs[i]);
      }, 2000);
      return () => clearInterval(intv);
    }
  }, [isGenerating]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m: any, i) => (
          <div key={i} className={`p-3 rounded-xl text-sm backdrop-blur-md ${m.role === 'user' ? 'bg-indigo-600/20 text-indigo-100 ml-4 border border-indigo-500/30' : 'bg-white/[0.03] text-slate-300 mr-4 border border-white/5'}`}>
            {m.reasoning && (
              <div className="mb-3 border border-indigo-500/20 rounded-lg bg-black/40 backdrop-blur-md overflow-hidden shadow-[0_0_15px_rgba(99,102,241,0.1)] relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="px-3 py-2 text-xs font-bold text-indigo-300 flex items-center gap-2 bg-indigo-950/30 border-b border-indigo-500/10">
                  <BrainCircuit className="w-4 h-4 text-indigo-400 animate-pulse" />
                  <span className="tracking-wider uppercase">Agent Execution Pipeline</span>
                  <div className="ml-auto flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                  </div>
                </div>
                <div className="p-3 text-xs text-indigo-100/70 bg-transparent whitespace-pre-wrap font-mono leading-relaxed relative z-10 border-l-2 border-indigo-500/30 ml-2 my-2">
                  {m.reasoning}
                </div>
              </div>
            )}
            
            {m.structuredResponse && (
               <div className="mb-3 space-y-2 border border-slate-700/50 rounded-lg p-3 bg-slate-900/50">
                 <div className="flex justify-between items-center mb-2">
                   <span className="font-bold text-xs uppercase text-indigo-400">Agent Report</span>
                   <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${m.structuredResponse.status === 'Complete' ? 'bg-emerald-500/20 text-emerald-400' : m.structuredResponse.status === 'Running Stage' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-amber-500/20 text-amber-400'}`}>
                     {m.structuredResponse.status}
                   </span>
                 </div>
                 <div className="flex gap-2 mb-2">
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">{m.structuredResponse.mode}</span>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">{m.structuredResponse.editMode}</span>
                 </div>
                 <div className="text-xs text-slate-300"><span className="text-slate-500 font-bold">Task:</span> {m.structuredResponse.task}</div>
                 <div className="text-xs text-slate-300"><span className="text-slate-500 font-bold">Plan:</span> {m.structuredResponse.plan}</div>
                 <div className="text-xs text-slate-300"><span className="text-slate-500 font-bold">Changes:</span> {m.structuredResponse.changesMade}</div>
                 
                 <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                   <div className="bg-slate-950 p-2 rounded border border-slate-800">
                     <span className="font-bold text-slate-500 block mb-1">Status Checks</span>
                     <div>Runner: <span className={m.structuredResponse.runnerCheck?.includes('pass') ? 'text-emerald-400' : 'text-slate-300'}>{m.structuredResponse.runnerCheck}</span></div>
                     <div>Preview: <span className={m.structuredResponse.previewCheck?.includes('pass') ? 'text-emerald-400' : 'text-slate-300'}>{m.structuredResponse.previewCheck}</span></div>
                     <div>Save: <span className={m.structuredResponse.saveCheck?.includes('saved') ? 'text-emerald-400' : 'text-slate-300'}>{m.structuredResponse.saveCheck}</span></div>
                   </div>
                   <div className="bg-slate-950 p-2 rounded border border-slate-800">
                     <span className="font-bold text-slate-500 block mb-1">Safety</span>
                     <div>Snapshot: <span className={m.structuredResponse.safetyCheck?.snapshotCreated ? 'text-emerald-400' : 'text-rose-400'}>{m.structuredResponse.safetyCheck?.snapshotCreated ? 'Yes' : 'No'}</span></div>
                     <div>Secrets Safe: <span className={!m.structuredResponse.safetyCheck?.secretsExposed ? 'text-emerald-400' : 'text-rose-400'}>{!m.structuredResponse.safetyCheck?.secretsExposed ? 'Yes' : 'No'}</span></div>
                   </div>
                 </div>
                 
                 <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-indigo-300 font-bold">
                   Next: {m.structuredResponse.nextStep}
                 </div>
               </div>
            )}

            {m.image && <img src={m.image} alt="User Upload" className="max-h-32 rounded mb-2 border border-slate-700" />}
            {m.content}
          </div>
        ))}
        {isGenerating && (
          <div className="relative p-4 rounded-xl border border-indigo-500/30 bg-black/40 backdrop-blur-xl mr-4 shadow-[0_0_30px_rgba(99,102,241,0.15)] overflow-hidden">
            <div className="absolute top-0 left-0 h-0.5 w-full bg-slate-800">
              <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 animate-[pulse_2s_ease-in-out_infinite] w-full" />
            </div>
            <div className="relative z-10 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <BrainCircuit className="w-5 h-5 text-indigo-400 relative z-10" />
                    <div className="absolute inset-0 bg-indigo-500 blur-md opacity-50 animate-pulse" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest animate-pulse">
                      Nova AI Orchestrator
                    </span>
                    <span className="text-xs font-medium text-slate-200 mt-0.5">
                      Delegating Tasks...
                    </span>
                  </div>
                </div>
                <button onClick={handleStop} className="text-rose-400 hover:text-white flex items-center gap-1 text-[10px] px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/40 border border-rose-500/20 rounded-full transition-all uppercase font-bold tracking-wider shadow-[0_0_10px_rgba(244,63,94,0.2)]">
                  <StopCircle className="w-3 h-3" /> Abort
                </button>
              </div>

              {/* Agent Pipeline Graph */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-indigo-500/10">
                <div className={`flex flex-col items-center text-center gap-2 p-2 rounded-lg transition-all duration-500 ${progressMsg.includes('memory') || progressMsg.includes('snapshot') ? 'bg-indigo-500/20 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)] scale-105' : 'bg-slate-900/50 border border-slate-800 opacity-50'}`}>
                  <Database className={`w-4 h-4 ${progressMsg.includes('memory') || progressMsg.includes('snapshot') ? 'text-indigo-400 animate-pulse' : 'text-slate-500'}`} />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-300">Architect</span>
                </div>
                <div className={`flex flex-col items-center text-center gap-2 p-2 rounded-lg transition-all duration-500 ${progressMsg.includes('Inspecting') ? 'bg-purple-500/20 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.2)] scale-105' : 'bg-slate-900/50 border border-slate-800 opacity-50'}`}>
                  <Palette className={`w-4 h-4 ${progressMsg.includes('Inspecting') ? 'text-purple-400 animate-pulse' : 'text-slate-500'}`} />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-300">Designer</span>
                </div>
                <div className={`flex flex-col items-center text-center gap-2 p-2 rounded-lg transition-all duration-500 ${progressMsg.includes('Applying') ? 'bg-cyan-500/20 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)] scale-105' : 'bg-slate-900/50 border border-slate-800 opacity-50'}`}>
                  <Code className={`w-4 h-4 ${progressMsg.includes('Applying') ? 'text-cyan-400 animate-pulse' : 'text-slate-500'}`} />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-300">Developer</span>
                </div>
                <div className={`flex flex-col items-center text-center gap-2 p-2 rounded-lg transition-all duration-500 ${progressMsg.includes('Running') || progressMsg.includes('Validating') ? 'bg-emerald-500/20 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)] scale-105' : 'bg-slate-900/50 border border-slate-800 opacity-50'}`}>
                  <ShieldCheck className={`w-4 h-4 ${progressMsg.includes('Running') || progressMsg.includes('Validating') ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-300">QA Tester</span>
                </div>
              </div>
              <div className="text-[10px] text-center text-indigo-300/70 font-mono tracking-widest mt-1">
                {progressMsg.toUpperCase()}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-white/5 bg-transparent backdrop-blur-sm z-10">
        {attachedImage && (
          <div className="mb-2 relative inline-block">
            <img src={attachedImage} alt="Preview" className="h-16 rounded border border-indigo-500/50" />
            <button onClick={() => setAttachedImage(null)} className="absolute -top-2 -right-2 bg-slate-800 text-slate-300 rounded-full p-0.5 border border-white/10 hover:text-rose-400">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">

          </div>
          <button onClick={handleClearChat} className="text-[10px] uppercase font-bold text-slate-500 hover:text-rose-400 flex items-center gap-1 transition-colors">
            <Trash2 className="w-3 h-3" /> Clear Chat
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex relative">
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
          />
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            className="absolute left-2 top-2.5 p-1 z-10 text-slate-400 hover:text-indigo-400 transition-colors"
            title="Attach Design Reference"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
          <input 
            type="text" 
            ref={chatInputRef}
            value={prompt} 
            onChange={(e) => setPrompt(e.target.value)} 
            placeholder="Build me a... or hold ALT + click an element to select it"
            className="w-full bg-white/[0.05] border border-white/10 rounded-lg pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors text-slate-200 placeholder:text-slate-500 backdrop-blur-md shadow-inner"
          />
          <button type="submit" disabled={isGenerating} className="absolute right-2 top-2.5 p-1 text-slate-400 hover:text-indigo-400 disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
          <button type="submit" ref={hiddenSubmitRef} className="hidden" />
        </form>
      </div>
    </div>
  );
}

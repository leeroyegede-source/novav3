import React, { useState, useRef, useEffect } from 'react';
import { Send, StopCircle, Undo2, BrainCircuit, Image as ImageIcon, X, History, Trash2 } from 'lucide-react';
import { VersionManager } from '@/lib/memory/versionManager';
import { ProjectMemory } from '@/lib/memory/projectMemory';
import { LocalDB, STORE_CHAT } from '@/lib/storage/indexedDB';

export function ChatPanel({ files, setFiles, setLogs, clearChatTrigger, reloadChatTrigger, appMode }: { files: Record<string, string>, setFiles: (f: Record<string, string>) => void, setLogs: (cb: (prev: string[]) => string[]) => void, clearChatTrigger?: number, reloadChatTrigger?: number, appMode?: string }) {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<{role: string, content: string, reasoning?: string, image?: string}[]>([{ role: 'agent', content: "Welcome to NovaAI! Describe the app you want to build or drop a design screenshot."}]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<Record<string, string>[]>([files]);
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

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
      
      let wipeExisting = false;
      if (!isDemo && Object.keys(files).length > 2) {
        const wantsToModify = window.confirm("An existing project is loaded in the workspace. \n\nClick 'OK' to selectively UPDATE the existing files.\nClick 'Cancel' to WIPE the workspace and generate a completely new app.");
        wipeExisting = !wantsToModify;
        if (wipeExisting) {
          setLogs(prev => [...prev, `[SYSTEM] User chose to wipe the existing workspace for clean generation.`]);
        } else {
          setLogs(prev => [...prev, `[SYSTEM] User chose to modify existing workspace.`]);
        }
      }
      
      const filesToSend = (isDemo || wipeExisting) ? {} : files;
      
      if (isDemo) {
         setLogs(prev => [...prev, `[SYSTEM] Wiping demo boilerplate for clean generation...`]);
      }

      // Prepare conversational history and memory to pass to the agent
      const conversationHistory = messages.map(m => ({ role: m.role, content: m.content }));
      const memoryState = ProjectMemory.getMemory();
      
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: userMsg, 
          currentFiles: filesToSend, 
          imageBase64: currentImage,
          history: conversationHistory,
          appMode: appMode,
          memory: memoryState
        }),
        signal: abortControllerRef.current.signal
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${res.status}`);
      }
      
      const data = await res.json();
      
      if (data.files) {
        const newFiles = (isDemo || wipeExisting) ? data.files : { ...files, ...data.files };
        setHistory(prev => {
          const newHistory = prev.slice(0, timelineIndex + 1);
          newHistory.push(newFiles);
          return newHistory;
        });
        VersionManager.saveSnapshot(newFiles, `AI Agent: ${userMsg}`);
        ProjectMemory.addItem({
          type: 'todo',
          title: `AI Task Complete`,
          content: `Executed user request: ${userMsg}`,
          importance: 'medium'
        });
        setTimelineIndex(prev => prev + 1);
        setFiles(newFiles);
        setLogs(prev => [...prev, `[SYSTEM] Applied file operations. Snapshot & Memory saved.`]);
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
          <div key={i} className={`p-3 rounded-xl text-sm ${m.role === 'user' ? 'bg-indigo-600/20 text-indigo-100 ml-4 border border-indigo-500/30' : 'bg-slate-800/50 text-slate-300 mr-4 border border-slate-700/50'}`}>
            {m.reasoning && (
              <div className="mb-3 border border-slate-700 rounded bg-slate-900 overflow-hidden shadow-lg">
                <div className="px-3 py-1.5 text-xs font-bold text-slate-400 flex items-center gap-2 bg-slate-800 border-b border-slate-700">
                  <BrainCircuit className="w-3.5 h-3.5 text-indigo-400" /> Agent Execution Plan
                </div>
                <div className="p-3 text-xs text-slate-300 bg-slate-950 whitespace-pre-wrap font-mono leading-relaxed">
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
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-700 bg-slate-800/30 mr-4">
            <div className="text-xs text-slate-400 animate-pulse flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-indigo-400" /> {progressMsg}
            </div>
            <button onClick={handleStop} className="text-rose-400 hover:text-rose-300 flex items-center gap-1 text-[10px] px-2 py-1 bg-rose-500/10 rounded transition-colors uppercase font-bold tracking-wider">
              <StopCircle className="w-3 h-3" /> Stop
            </button>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-950">
        {attachedImage && (
          <div className="mb-2 relative inline-block">
            <img src={attachedImage} alt="Preview" className="h-16 rounded border border-indigo-500/50" />
            <button onClick={() => setAttachedImage(null)} className="absolute -top-2 -right-2 bg-slate-800 text-slate-300 rounded-full p-0.5 border border-slate-600 hover:text-rose-400">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="flex justify-end mb-2">
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
            className="absolute left-2 top-2.5 p-1 text-slate-400 hover:text-indigo-400 transition-colors"
            title="Attach Design Reference"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
          <input 
            type="text" 
            value={prompt} 
            onChange={(e) => setPrompt(e.target.value)} 
            placeholder="Build me a... or attach an image"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button type="submit" disabled={isGenerating} className="absolute right-2 top-2.5 p-1 text-slate-400 hover:text-indigo-400 disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

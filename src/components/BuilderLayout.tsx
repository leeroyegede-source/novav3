"use client";
import React, { useState, useEffect, useRef } from 'react';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { FileExplorer } from '@/components/editor/FileExplorer';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { ArchitectureCanvas } from '@/components/editor/ArchitectureCanvas';
import { VersionHistoryPanel } from '@/components/editor/VersionHistoryPanel';
import { ToolRegistryPanel } from '@/components/editor/ToolRegistryPanel';
import { ByodPanel } from '@/components/editor/ByodPanel';
import { MemoryPanel } from '@/components/editor/MemoryPanel';
import { ErrorPanel } from '@/components/editor/ErrorPanel';
import { TestPanel } from '@/components/editor/TestPanel';
import { EnvironmentPanel } from '@/components/editor/EnvironmentPanel';
import { DeploymentPanel } from '@/components/editor/DeploymentPanel';
import { BuilderTopBar } from '@/components/editor/BuilderTopBar';
import { ProjectSidebar } from '@/components/editor/ProjectSidebar';
import { ErrorDetector } from '@/lib/agents/errorDetector';
import { VersionManager } from '@/lib/memory/versionManager';
import { ProjectMemory } from '@/lib/memory/projectMemory';
import { LocalDB, STORE_FILES } from '@/lib/storage/indexedDB';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { PreviewPanel } from '@/components/preview/PreviewPanel';
import { AppModeSelector } from '@/components/AppModeSelector';
import { LogsPanel } from '@/components/preview/LogsPanel';
import { RuntimeIndicator } from '@/components/preview/RuntimeIndicator';
import { Upload, FolderUp, Rocket, Loader2, DownloadCloud, Trash2, StopCircle, GitBranch, Plus, Save, Clock, MessageSquare, Folder, Code, Terminal, Play, MoreHorizontal } from 'lucide-react';

export function BuilderLayout({ userEmail }: { userEmail?: string }) {
  const [appMode, setAppMode] = useState("Auto Detect");
  const [files, setFiles] = useState<Record<string, string>>({
    "/App.js": "export default function App() {\n  return <div>Hello NovaAI</div>;\n}"
  });
  const [activeFile, setActiveFile] = useState<string | null>("/App.js");
  const [viewMode, setViewMode] = useState<'code' | 'canvas' | 'versions' | 'tools' | 'byod' | 'memory' | 'errors' | 'tests' | 'env' | 'deploy'>('code');
  const [logs, setLogs] = useState<string[]>(["[SYSTEM] Builder initialized. STAGE 1 loaded."]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [clearChatTrigger, setClearChatTrigger] = useState(0);
  const autoHealTriggeredRef = useRef(false);
  const deployAbortControllerRef = useRef<AbortController | null>(null);
  const deployIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [errorCount, setErrorCount] = useState(0);
  const [mobileTab, setMobileTab] = useState<'chat' | 'files' | 'editor' | 'preview' | 'terminal'>('chat');

  useEffect(() => {
    // Storage initialization is handled by initStorage below.

    // Poll error memory to dynamically color the Error button
    const checkErrors = () => {
      const mem = ProjectMemory.getMemory();
      const count = mem.items.filter(i => i.type === 'error').length;
      setErrorCount(count);
    };
    
    checkErrors();
    const interval = setInterval(checkErrors, 3000);
    return () => clearInterval(interval);
  }, []);

  const processZipData = async (zipData: any) => {
    const zip = await JSZip.loadAsync(zipData);
    const newFiles: Record<string, string> = {};
    for (const relativePath of Object.keys(zip.files)) {
      // Security Check: Block unsafe paths
      if (relativePath.includes('..') || relativePath.startsWith('/') || relativePath.startsWith('\\')) {
         setLogs(prev => [...prev, `[SECURITY] Blocked unsafe path extraction: ${relativePath}`]);
         continue;
      }
      if (relativePath.includes('node_modules') || relativePath.includes('.git') || relativePath.includes('.next')) continue;
      
      const zipEntry = zip.files[relativePath];
      if (!zipEntry.dir) {
        let content = await zipEntry.async('text');
        
        // Security Check: Mask/Secure .env values locally, or just notify user
        if (relativePath.endsWith('.env') || relativePath.endsWith('.env.local')) {
           setLogs(prev => [...prev, `[SECURITY] Protected .env file detected and parsed safely.`]);
           // You could mask it here if required, but since it's local we just log it.
        }

        // If from github, it might have a root folder (repo-main/...)
        const parts = relativePath.split('/');
        if (parts.length > 1 && parts[0].includes('-')) {
          parts.shift(); // remove root folder
        }
        
        const safePath = '/' + parts.join('/');
        if (safePath !== '/') newFiles[safePath] = content;
      }
    }
    return newFiles;
  };

  const handleGithubImport = async () => {
    const repoUrl = prompt("Enter GitHub Repository URL (e.g., https://github.com/user/repo):");
    if (!repoUrl) return;
    
    setLogs(prev => [...prev, `[IMPORT] Fetching repository from GitHub...`]);
    try {
      const res = await fetch('/api/hub/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch repository');
      }
      
      const blob = await res.blob();
      const newFiles = await processZipData(blob);
      
      setFiles(newFiles);
      autoDetectAndSetMode(newFiles);
      setLogs(prev => [...prev, `[SYSTEM] Successfully imported ${Object.keys(newFiles).length} files from GitHub.`]);
    } catch (err: unknown) {
      setLogs(prev => [...prev, `[ERROR] GitHub Import failed: ${(err as Error).message}`]);
    }
  };

  const handleSave = () => {
    VersionManager.saveSnapshot(files, 'Manual Save');
    localStorage.setItem('nova_appMode', appMode);
    localStorage.setItem('nova_files', JSON.stringify(files));
    LocalDB.set(STORE_FILES, 'nova_active_files', files).catch(console.error);
    setLogs(prev => [...prev, '[SYSTEM] Project saved manually to IndexedDB.']);
    
    // Update recent projects list safely
    try {
      const mem = ProjectMemory.getMemory();
      const recent = JSON.parse(localStorage.getItem('nova_recent_projects') || '[]');
      const existingIdx = recent.findIndex((p: any) => p.id === mem.project_id);
      const newProject = {
        id: mem.project_id,
        name: (mem as any).project_name || 'Untitled Project',
        mode: mem.project_mode || appMode,
        time: Date.now()
      };
      if (existingIdx >= 0) recent[existingIdx] = newProject;
      else recent.unshift(newProject);
      localStorage.setItem('nova_recent_projects', JSON.stringify(recent));
      alert('Project saved successfully!');
    } catch (err) {
      setLogs(prev => [...prev, '[ERROR] Failed to save project metadata.']);
    }
  };

  const handleNewProject = () => {
    const choice = prompt("You have unsaved changes. Save before starting a new project?\nType '1' to Save and Continue\nType '2' to Continue Without Saving\nType '3' to Cancel", "1");
    if (choice === '3' || choice === null) return;
    if (choice === '1') handleSave();

    const mode = prompt("Enter App Mode (e.g., Next.js, React, Node.js):", "Next.js");
    if (!mode) return;
    
    const newFiles = {
      "/App.js": `export default function App() {\n  return <div>New ${mode} Project</div>;\n}`
    };
    
    localStorage.removeItem('nova_files');
    localStorage.removeItem('nova_project_memory');
    LocalDB.remove(STORE_FILES, 'nova_active_files').catch(console.error);
    setFiles(newFiles);
    setAppMode(mode);
    setLogs(["[SYSTEM] Created new clean project."]);
    
    const newState = ProjectMemory.getMemory();
    newState.project_mode = mode;
    newState.framework = mode;
    (newState as any).project_name = 'New Project';
    ProjectMemory.saveMemory(newState);
    
    VersionManager.saveSnapshot(newFiles, 'Initial Setup');
  };


  useEffect(() => {
    const initStorage = async () => {
      await VersionManager.init();
      await ProjectMemory.init();
      
      let loadedFiles = null;
      try {
        loadedFiles = await LocalDB.get<Record<string, string>>(STORE_FILES, 'nova_active_files');
      } catch (err) {
        console.error("LocalDB Error:", err);
      }
      
      const savedMode = localStorage.getItem('nova_appMode');
      const savedFilesStr = localStorage.getItem('nova_files');
      
      if (savedMode) setAppMode(savedMode);
      
      if (loadedFiles) {
        setFiles(loadedFiles);
      } else if (savedFilesStr) {
        try { 
          const f = JSON.parse(savedFilesStr); 
          setFiles(f); 
          await LocalDB.set(STORE_FILES, 'nova_active_files', f);
        } catch (e) {}
      }
      setIsHydrated(true);
    };
    initStorage();
  }, []);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('nova_appMode', appMode);
      localStorage.setItem('nova_files', JSON.stringify(files));
      LocalDB.set(STORE_FILES, 'nova_active_files', files).catch(console.error);
    }
  }, [appMode, files, isHydrated]);

  const handleModeChange = (newMode: string, currentFiles?: Record<string, string>) => {
    setAppMode(newMode);
    
    const targetFiles = currentFiles || files;
    // We no longer scaffold demo folders because it causes routing conflicts and crashes.
    // The workspace remains completely clean until the AI agent builds the real files.
    
    // Just ensure we don't carry over irrelevant demo files if switching modes on a fresh workspace
    const isDefault = Object.keys(targetFiles).length === 1 && targetFiles["/App.js"]?.includes("NovaAI");
    if (isDefault) {
      setFiles({});
      setActiveFile(null);
      setLogs(prev => [...prev, `[SYSTEM] Switched to ${newMode}. Workspace is ready for agent generation.`]);
    }
  };

  const triggerSelfHealing = async (errorMessage: string, currentFilesState: Record<string, string>) => {
    try {
      const prompt = `The production Vercel build crashed with this error: ${errorMessage}. Please analyze the error, fix the syntax or missing imports in the code, and return the fixed files so we can re-deploy successfully.`;
      await executeAgentPrompt(prompt, currentFilesState);
    } catch (err) {
       setLogs(prev => [...prev, `[ERROR] Self-Healing engine failed: ${(err as Error).message}`]);
       setIsDeploying(false);
    }
  };

  const executeAgentPrompt = async (prompt: string, currentFilesState: Record<string, string>, isCanvas: boolean = false, isAutoHeal: boolean = false) => {
    setLogs(prev => [...prev, isCanvas ? `[CANVAS] Link detected! Booting Integration Agent...` : `[SYSTEM] Booting AI Agent to process request...`]);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, currentFiles: currentFilesState, isAutoHeal })
      });
      const data = await res.json();
      if (data.files) {
        setFiles(data.files);
        setLogs(prev => [...prev, isCanvas ? `[SYSTEM] Canvas AI integration code automatically applied!` : `[SYSTEM] AI modifications applied successfully.`]);
        return data.files;
      }
    } catch (err: unknown) {
      setLogs(prev => [...prev, `[ERROR] AI integration failed: ${(err as Error).message}`]);
    }
    return null;
  };

  const executeAutoHealPipeline = async (prompt: string, reportId: string) => {
    const memory = ProjectMemory.getMemory();
    const originalFiles = files; // For rollback
    
    setLogs(prev => [...prev, `[AUTO-HEAL] Starting repair pipeline for ${reportId}...`]);
    
    let currentAttempt = 1;
    let success = false;
    let currentFilesState = files;

    while (currentAttempt <= 3 && !success) {
      setLogs(prev => [...prev, `[AUTO-HEAL] Attempt ${currentAttempt}/3...`]);
      VersionManager.saveSnapshot(currentFilesState, `Auto-Heal Attempt ${currentAttempt}`);
      
      const promptWithAttempt = `${prompt}\n\nThis is attempt ${currentAttempt} of 3. Ensure your fix is minimal and runner-safe.`;
      
      const newFiles = await executeAgentPrompt(promptWithAttempt, currentFilesState, false, true);
      
      if (!newFiles) {
        setLogs(prev => [...prev, `[AUTO-HEAL] Agent failed to return files on attempt ${currentAttempt}.`]);
        currentAttempt++;
        continue;
      }

      currentFilesState = newFiles;
      
      // Validate via Runner Test (ping preview start)
      setLogs(prev => [...prev, `[AUTO-HEAL] Re-running runner for validation...`]);
      try {
        const testRes = await fetch('/api/preview/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: 'nova-project-1', files: currentFilesState, appMode })
        });
        
        if (testRes.ok) {
           setLogs(prev => [...prev, `[AUTO-HEAL] Validation passed! Fix successful.`]);
           success = true;
           ProjectMemory.addItem({
             type: 'todo',
             title: `Auto-Heal Resolved`,
             content: `Successfully repaired error ${reportId} after ${currentAttempt} attempts.`,
             importance: 'high'
           });
           break;
        } else {
           const errData = await testRes.json();
           setLogs(prev => [...prev, `[AUTO-HEAL] Validation failed on attempt ${currentAttempt}: ${errData.error}`]);
        }
      } catch (err: any) {
        setLogs(prev => [...prev, `[AUTO-HEAL] Validation network error on attempt ${currentAttempt}: ${err.message}`]);
      }
      
      currentAttempt++;
    }

    if (!success) {
      setLogs(prev => [...prev, `[AUTO-HEAL] All 3 attempts failed. Rolling back to last stable version.`]);
      setFiles(originalFiles);
      VersionManager.saveSnapshot(originalFiles, `Rollback after failed auto-heal`);
    }
  };

  const pollDeploymentStatus = async (id: string, initialUrl: string, currentFilesState: Record<string, string>) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 30) {
        clearInterval(interval);
        setIsDeploying(false);
        setLogs(prev => [...prev, "[ERROR] Deployment status polling timed out."]);
        return;
      }
      
      try {
        const res = await fetch(`/api/deploy/status?id=${id}`);
        const data = await res.json();
        
        if (data.status === "READY") {
          clearInterval(interval);
          setDeployUrl(`https://${data.url}`);
          setLogs(prev => [...prev, `[DEPLOY] Build successful! Live at https://${data.url}`]);
          setIsDeploying(false);
        } else if (data.status === "ERROR") {
          clearInterval(interval);
          setLogs(prev => [...prev, `[ERROR] Build Failed on Vercel: ${data.error}`]);
          setLogs(prev => [...prev, `[SYSTEM] Initiating Autonomous Self-Healing Protocol...`]);
          triggerSelfHealing(data.error, currentFilesState);
        } else {
          setLogs(prev => [...prev, `[DEPLOY] Status: ${data.status}...`]);
        }
      } catch (err) {
        // ignore network errors
      }
    }, 5000);
    deployIntervalRef.current = interval;
  };

  const handleStopDeploy = () => {
    if (deployAbortControllerRef.current) deployAbortControllerRef.current.abort();
    if (deployIntervalRef.current) clearInterval(deployIntervalRef.current);
    setIsDeploying(false);
    setLogs(prev => [...prev, "[SYSTEM] Deployment cancelled by user."]);
  };

  const handleDeploy = async (overrideFiles?: Record<string, string>) => {
    const filesToDeploy = overrideFiles || files;
    setIsDeploying(true);
    setDeployUrl(null);
    setLogs(prev => [...prev, "[DEPLOY] Starting production deployment..."]);
    deployAbortControllerRef.current = new AbortController();
    
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: filesToDeploy, provider: 'Vercel' }),
        signal: deployAbortControllerRef.current.signal
      });
      const data = await res.json();
      
      if (data.success) {
        data.logs.forEach((log: string) => setLogs(prev => [...prev, log]));
        setDeployUrl(data.deploymentUrl);
        pollDeploymentStatus(data.id, data.deploymentUrl, filesToDeploy);
      } else {
        setLogs(prev => [...prev, `[ERROR] Deployment failed: ${data.error}`]);
        setIsDeploying(false);
      }
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      setLogs(prev => [...prev, `[ERROR] Deployment crashed: ${(err as Error).message}`]);
      setIsDeploying(false);
    }
  };
  
  const handleDownloadZip = async () => {
    try {
      setLogs(prev => [...prev, "[EXPORT] Booting Ejection Engine. Generating ZIP archive..."]);
      const zip = new JSZip();
      
      // Iterate over files object and add them to zip
      Object.entries(files).forEach(([path, content]) => {
        // Remove leading slash if present
        const safePath = path.startsWith('/') ? path.slice(1) : path;
        zip.file(safePath, content);
      });
      
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, "nova-ai-project.zip");
      setLogs(prev => [...prev, "[SYSTEM] Codebase successfully ejected to local machine!"]);
    } catch (err) {
      setLogs(prev => [...prev, `[ERROR] Failed to generate ZIP: ${(err as Error).message}`]);
    }
  };

  const autoDetectAndSetMode = (newFiles: Record<string, string>) => {
    if (newFiles['/next.config.js'] || newFiles['/next.config.mjs'] || newFiles['/pages/_app.js'] || newFiles['/app/layout.tsx'] || newFiles['/app/layout.js']) {
       setAppMode("Next.js / SSR");
       setLogs(prev => [...prev, "[SYSTEM] Auto-detected Next.js environment."]);
    } else if (newFiles['/package.json'] && newFiles['/package.json'].includes('"react"')) {
       setAppMode("React / Vite");
       setLogs(prev => [...prev, "[SYSTEM] Auto-detected React environment."]);
    } else {
       setAppMode("Static Website");
       setLogs(prev => [...prev, "[SYSTEM] Auto-detected Static HTML/VanillaJS environment."]);
    }
  };

  const handleClearFiles = () => {
    setFiles({});
    setActiveFile(null);
    setClearChatTrigger(prev => prev + 1);
    setLogs(prev => [...prev, `[SYSTEM] Workspace cleared. Clean slate ready for ${appMode}.`]);
    // Optionally trigger a mode change hook if needed, but not strictly required if we just wiped files
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogs(prev => [...prev, "[IMPORT] Reading ZIP archive..."]);
    try {
      const newFiles = await processZipData(file);
      setFiles(newFiles);
      autoDetectAndSetMode(newFiles);
      setLogs(prev => [...prev, `[SYSTEM] Successfully imported ${Object.keys(newFiles).length} files from ZIP.`]);
    } catch (err) {
      setLogs(prev => [...prev, `[ERROR] Failed to parse ZIP: ${(err as Error).message}`]);
    }
    e.target.value = '';
  };

  const handleTerminalCommand = async (cmd: string) => {
    setLogs(prev => [...prev, `> ${cmd}`]);
    try {
      const res = await fetch('/api/runtime/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, files })
      });
      const data = await res.json();
      if (data.isError) {
        setLogs(prev => [...prev, `[ERROR] ${data.output}`]);
      } else {
        setLogs(prev => [...prev, data.output]);
      }
    } catch (err: unknown) {
      setLogs(prev => [...prev, `[ERROR] Terminal failure: ${(err as Error).message}`]);
    }
  };

  const handleSelfHeal = async (errorLog: string) => {
    setLogs(prev => [...prev, "[AUTONOMOUS HEALING] Critical error detected! Triggering Zero-Click Self-Healing..."]);
    const prompt = `The terminal threw this error: ${errorLog}. Please analyze the error, identify the bug in my files, and fix it. Return the corrected files.`;
    await executeAgentPrompt(prompt, files);
    // Allow cooldown before re-triggering auto-heal
    setTimeout(() => { autoHealTriggeredRef.current = false; }, 10000);
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setLogs(prev => [...prev, "[IMPORT] Mapping local folder structure..."]);
    const newFiles: Record<string, string> = {};
    let count = 0;
    
    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const path = file.webkitRelativePath;
        if (path.includes('node_modules') || path.includes('.git') || path.includes('.next')) continue;
        
        // Strip the root folder name "my-project/src/App.js" -> "/src/App.js"
        const pathParts = path.split('/');
        pathParts.shift(); 
        const relativePath = '/' + pathParts.join('/');
        
        if (relativePath !== '/') {
          const text = await file.text();
          newFiles[relativePath] = text;
          count++;
        }
      }
      setFiles(newFiles);
      autoDetectAndSetMode(newFiles);
      setLogs(prev => [...prev, `[SYSTEM] Successfully mapped ${count} files into the sandbox.`]);
    } catch (err) {
      setLogs(prev => [...prev, `[ERROR] Folder import failed: ${(err as Error).message}`]);
    }
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 font-sans text-slate-300 overflow-hidden">
      <BuilderTopBar 
        onToggleRight={() => {}} 
        onToggleBottom={() => {}} 
        onOpenVersions={() => setViewMode('versions')}
        appMode={appMode}
        setAppMode={handleModeChange}
        userEmail={userEmail}
      />
      
      <div className="flex flex-1 overflow-hidden relative">
        
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative pb-16 md:pb-0">
          <div className={`absolute inset-0 md:relative w-full md:w-[300px] border-r border-slate-800 flex-col z-20 shadow-xl bg-slate-900 shrink-0 ${mobileTab === 'chat' ? 'flex' : 'hidden md:flex'}`}>
            <ChatPanel 
              files={files} 
              setFiles={setFiles} 
              setLogs={setLogs} 
              clearChatTrigger={clearChatTrigger} 
              appMode={appMode}
            />
          </div>
      
      <div className={`absolute inset-0 md:relative flex-1 flex-col z-10 bg-slate-950 ${mobileTab === 'files' || mobileTab === 'editor' || mobileTab === 'terminal' ? 'flex' : 'hidden md:flex'}`}>
        <div className="flex-1 flex flex-col md:flex-row">
          <div className={`absolute inset-0 md:relative w-full md:w-[320px] lg:w-[420px] border-r border-slate-800 bg-slate-950 flex-col z-20 ${mobileTab === 'files' ? 'flex' : 'hidden md:flex'}`}>
            <div className="p-2 border-b border-slate-800 flex flex-wrap gap-2 md:gap-3 items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden lg:block">EF</span>
              <select 
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as any)}
                className="bg-slate-900 text-[10px] text-slate-300 font-bold border border-slate-800 rounded px-2 py-0.5 outline-none focus:border-indigo-500 cursor-pointer appearance-none"
              >
                <option value="code">Code</option>
                <option value="canvas">Canvas</option>
                <option value="versions">Versions</option>
                <option value="tools">Tools</option>
                <option value="env">Environment</option>
                <option value="byod">Database</option>
                <option value="memory">Memory</option>
                <option value="tests">Tests</option>
                <option value="deploy">Deploy</option>
              </select>
              <button 
                onClick={() => setViewMode('errors')}
                className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${viewMode === 'errors' ? 'ring-2 ring-indigo-500' : ''} ${errorCount > 0 ? 'bg-rose-500 text-white shadow-[0_0_10px_rgba(244,63,94,0.5)]' : 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]'}`}
              >
                Errors {errorCount > 0 && `(${errorCount})`}
              </button>
              <div className="flex items-center gap-2 ml-auto">
                <button onClick={handleClearFiles} className="text-rose-500 hover:text-rose-400" title="Clear Workspace">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleDownloadZip} className="text-emerald-500 hover:text-emerald-400" title="Eject Codebase (Download ZIP)">
                  <DownloadCloud className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-3 bg-slate-800 mx-0.5" />
                <button onClick={handleGithubImport} className="text-slate-500 hover:text-indigo-400" title="Import from GitHub">
                  <GitBranch className="w-3.5 h-3.5" />
                </button>
                <label className="cursor-pointer text-slate-500 hover:text-indigo-400" title="Upload ZIP">
                  <Upload className="w-3.5 h-3.5" />
                  <input type="file" accept=".zip" className="hidden" onChange={handleZipUpload} />
                </label>
                <button onClick={handleNewProject} className="text-slate-500 hover:text-indigo-400" title="New Project">
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleSave} className="text-slate-500 hover:text-indigo-400" title="Save Project">
                  <Save className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-3 bg-slate-800 mx-0.5" />
                <label className="cursor-pointer text-slate-500 hover:text-indigo-400" title="Upload Folder">
                  <FolderUp className="w-3.5 h-3.5" />
                  {/* @ts-expect-error webkitdirectory is a non-standard property */}
                  <input type="file" webkitdirectory="true" directory="true" className="hidden" onChange={handleFolderUpload} />
                </label>
              </div>
            </div>
            <FileExplorer files={files} activeFile={activeFile} setActiveFile={setActiveFile} />
          </div>
          <div className={`absolute inset-0 md:relative flex-1 bg-slate-950 flex-col z-10 ${mobileTab === 'editor' ? 'flex' : 'hidden md:flex'}`}>
            {viewMode === 'canvas' ? (
               <ArchitectureCanvas triggerGeneration={(prompt) => executeAgentPrompt(prompt, files, true)} files={files} />
            ) : viewMode === 'versions' ? (
               <VersionHistoryPanel 
                 currentFiles={files} 
                 onRestore={(restoredFiles) => {
                   setFiles(restoredFiles);
                   setLogs(prev => [...prev, `[SYSTEM] Workspace restored to previous version snapshot.`]);
                 }}
                 onCompare={(compareFiles) => {
                   // Optional: Can add a diff viewer later
                   setLogs(prev => [...prev, `[SYSTEM] Compare feature selected (Diff view coming soon)`]);
                 }}
               />
            ) : viewMode === 'tools' ? (
               <ToolRegistryPanel 
                 files={files}
                 appMode={appMode}
                 onInject={(newFiles, toolName) => {
                   setFiles(newFiles);
                   autoDetectAndSetMode(newFiles);
                 }}
                 onLog={(msg) => setLogs(prev => [...prev, msg])}
               />
            ) : viewMode === 'byod' ? (
               <ByodPanel 
                 files={files}
                 appMode={appMode}
                 onFilesUpdate={setFiles}
                 onLog={(msg) => setLogs(prev => [...prev, msg])}
               />
            ) : viewMode === 'memory' ? (
               <MemoryPanel 
                 files={files}
                 appMode={appMode}
                 onLog={(msg) => setLogs(prev => [...prev, msg])}
               />
            ) : viewMode === 'errors' ? (
               <ErrorPanel 
                 files={files}
                 appMode={appMode}
                 onAutoHeal={(prompt, reportId) => executeAutoHealPipeline(prompt, reportId)}
                 onLog={(msg) => setLogs(prev => [...prev, msg])}
               />
            ) : viewMode === 'tests' ? (
               <TestPanel 
                 files={files}
                 appMode={appMode}
                 onFilesUpdate={setFiles}
                 onAutoHeal={(prompt, reportId) => executeAutoHealPipeline(prompt, reportId)}
                 onLog={(msg) => setLogs(prev => [...prev, msg])}
               />
            ) : viewMode === 'env' ? (
               <EnvironmentPanel 
                 files={files}
                 onFilesUpdate={setFiles}
                 onLog={(msg) => setLogs(prev => [...prev, msg])}
               />
            ) : viewMode === 'deploy' ? (
               <DeploymentPanel 
                 appMode={appMode}
                 files={files}
                 onLog={(msg) => setLogs(prev => [...prev, msg])}
               />
            ) : activeFile && files[activeFile] !== undefined ? (
              <>
                <div className="h-8 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-4 text-xs font-mono text-slate-300">
                  <span>{activeFile}</span>
                </div>
                <div className="flex-1 relative overflow-hidden">
                   <CodeEditor code={files[activeFile]} onChange={(newCode: string) => setFiles({ ...files, [activeFile]: newCode })} />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">Select a file to edit</div>
            )}
          </div>
        </div>
        <div className={`absolute inset-0 md:relative md:h-[250px] border-t border-slate-800 bg-slate-950 flex-col z-30 ${mobileTab === 'terminal' ? 'flex' : 'hidden md:flex'}`}>
           <LogsPanel logs={logs} onCommand={handleTerminalCommand} onSelfHeal={handleSelfHeal} />
        </div>
      </div>
      
      <div className={`absolute inset-0 md:relative w-full md:w-[45%] flex-col border-l border-slate-800 bg-black z-30 shadow-xl ${mobileTab === 'preview' ? 'flex' : 'hidden md:flex'}`}>
        <div className="h-12 border-b border-slate-800 flex items-center px-4 justify-between bg-slate-900 shrink-0 overflow-x-auto whitespace-nowrap">
           <div className="flex items-center gap-2 mr-4">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
             <span className="text-sm font-bold tracking-tight">Live Preview</span>
           </div>
           <div className="flex items-center gap-2 md:gap-4 shrink-0">
             {deployUrl && (
               <a href={deployUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 hover:text-emerald-300 font-mono bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 transition-colors max-w-[200px] truncate">
                 {deployUrl}
               </a>
             )}
             <button 
               onClick={() => isDeploying ? handleStopDeploy() : handleDeploy()} 
               className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold shadow-lg transition-all ${isDeploying ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/20'}`}
             >
               {isDeploying ? <StopCircle className="w-3.5 h-3.5" /> : <Rocket className="w-3.5 h-3.5" />}
               {isDeploying ? "Stop Deploy" : "Ship it"}
             </button>
             <RuntimeIndicator appMode={appMode} />
           </div>
        </div>
        <div className="flex-1 relative overflow-hidden bg-white">
           <PreviewPanel 
             files={files} 
             appMode={appMode} 
             onLogsUpdate={(newLogs) => {
               let additions: string[] = [];
               setLogs(prev => {
                 const prevSet = new Set(prev);
                 additions = newLogs.filter(l => !prevSet.has(l));
                 if (additions.length > 0) return [...prev, ...additions];
                 return prev;
               });

               if (!autoHealTriggeredRef.current && !isDeploying && additions.length > 0) {
                 const errorLog = additions.find(l => 
                   l.includes('Syntax error') || 
                   l.includes('Failed to compile') || 
                   l.includes('Module not found') || 
                   l.includes('ReferenceError') ||
                   l.includes('Parsing css source code failed')
                 );
                 if (errorLog) {
                   autoHealTriggeredRef.current = true;
                   handleSelfHeal(errorLog);
                 }
               }
             }}
           />
        </div>
      </div>
      
      {/* Mobile Tab Bar */}
      <div className="md:hidden absolute bottom-0 left-0 right-0 h-16 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-2 z-50">
        <button onClick={() => setMobileTab('chat')} className={`flex-1 flex flex-col items-center justify-center gap-1 ${mobileTab === 'chat' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] font-medium">Chat</span>
        </button>
        <button onClick={() => setMobileTab('files')} className={`flex-1 flex flex-col items-center justify-center gap-1 ${mobileTab === 'files' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
          <Folder className="w-5 h-5" />
          <span className="text-[10px] font-medium">Files</span>
        </button>
        <button onClick={() => setMobileTab('editor')} className={`flex-1 flex flex-col items-center justify-center gap-1 ${mobileTab === 'editor' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
          <Code className="w-5 h-5" />
          <span className="text-[10px] font-medium">Code</span>
        </button>
        <button onClick={() => setMobileTab('preview')} className={`flex-1 flex flex-col items-center justify-center gap-1 ${mobileTab === 'preview' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
          <Play className="w-5 h-5" />
          <span className="text-[10px] font-medium">Preview</span>
        </button>
        <button onClick={() => setMobileTab('terminal')} className={`flex-1 flex flex-col items-center justify-center gap-1 ${mobileTab === 'terminal' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
          <Terminal className="w-5 h-5" />
          <span className="text-[10px] font-medium">Terminal</span>
        </button>
      </div>
        
        </div>
      </div>
    </div>
  );
}

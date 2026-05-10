"use client";
import React, { useState, useEffect, useRef } from 'react';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { NovaGuide } from '@/components/chat/NovaGuide';
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
import { supabase } from '@/lib/supabaseClient';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { PreviewPanel } from '@/components/preview/PreviewPanel';
import { AppModeSelector } from '@/components/AppModeSelector';
import { LogsPanel } from '@/components/preview/LogsPanel';
import { RuntimeIndicator } from '@/components/preview/RuntimeIndicator';
import { CloudSyncManager } from '@/lib/storage/cloudSync';
import { CloudProjectsModal } from '@/components/editor/CloudProjectsModal';
import { Cloud, Upload, FolderUp, Rocket, Loader2, DownloadCloud, Trash2, StopCircle, GitBranch, Plus, Save, Clock, MessageSquare, Folder, Code, Terminal, Play, MoreHorizontal, Settings2, History } from 'lucide-react';

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
  const [reloadChatTrigger, setReloadChatTrigger] = useState(0);
  const autoHealTriggeredRef = useRef(false);
  const deployAbortControllerRef = useRef<AbortController | null>(null);
  const deployIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [errorCount, setErrorCount] = useState(0);
  const [mobileTab, setMobileTab] = useState<'chat' | 'files' | 'editor' | 'tools' | 'preview' | 'terminal'>('chat');
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectMode, setNewProjectMode] = useState("Next.js");
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const [theme, setTheme] = useState<'godlike' | 'night' | 'day'>('godlike');

  const themeStyles = {
    godlike: {
      appBg: 'bg-[#05050A] text-slate-200',
      panelBg: 'bg-black/40 backdrop-blur-[32px] backdrop-saturate-150',
      centerBg: 'bg-black/20 backdrop-blur-[24px] backdrop-saturate-150',
      border: 'border border-white/5 border-t-white/10 shadow-inner',
      shadow: 'shadow-[0_24px_50px_rgba(0,0,0,0.8)] ring-1 ring-white/5',
      glow: true,
      text: 'text-slate-200',
      mobilePillBg: 'bg-black/60 backdrop-blur-[32px]'
    },
    night: {
      appBg: 'bg-slate-950 text-slate-300',
      panelBg: 'bg-slate-900',
      centerBg: 'bg-slate-900/80',
      border: 'border border-slate-800',
      shadow: 'shadow-2xl shadow-black/40',
      glow: false,
      text: 'text-slate-300',
      mobilePillBg: 'bg-slate-900'
    },
    day: {
      appBg: 'bg-[#09090b] text-white',
      panelBg: 'bg-black/20 backdrop-blur-[32px] backdrop-saturate-[200%]',
      centerBg: 'bg-black/10 backdrop-blur-[24px] backdrop-saturate-[150%]',
      border: 'border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]',
      shadow: 'shadow-[0_8px_40px_rgba(0,0,0,0.6)]',
      glow: false,
      text: 'text-white',
      mobilePillBg: 'bg-black/40 backdrop-blur-[32px]'
    }
  };

  const currentTheme = themeStyles[theme];

  const handleSaveToCloud = async () => {
    setIsCloudSaving(true);
    setLogs(prev => [...prev, '[SYSTEM] Saving project to cloud...']);
    const mem = ProjectMemory.getMemory();
    
    let currentName = mem.project_name;
    if (!currentName || currentName === 'New Project') {
      const promptName = prompt("Name this project before saving to Cloud:", "My Project");
      if (!promptName) {
        setIsCloudSaving(false);
        return;
      }
      currentName = promptName.trim();
      mem.project_name = currentName;
    }
    
    mem.project_mode = mem.project_mode || appMode;
    ProjectMemory.saveMemory(mem);

    const { success, error } = await CloudSyncManager.saveToCloud(mem.project_id, files, currentName);
    if (success) {
      setLogs(prev => [...prev, '[SYSTEM] Synced to Cloud successfully.']);
    } else {
      setLogs(prev => [...prev, `[ERROR] Cloud Save Failed: ${error}`]);
      alert(`Cloud Save Failed: ${error}`);
    }
    setIsCloudSaving(false);
  };

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
    
    let defaultName = "GitHub Repo";
    try {
      const urlObj = new URL(repoUrl);
      const parts = urlObj.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        defaultName = parts[1];
      }
    } catch(e) {}
    
    let projectName = prompt(`Name this imported project (GitHub):`, defaultName);
    if (!projectName) return;
    
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
      
      const mode = autoDetectAndSetMode(newFiles);
      
      const mem = ProjectMemory.clearMemory();
      mem.project_name = projectName.trim();
      mem.project_mode = mode;
      mem.framework = mode;
      ProjectMemory.saveMemory(mem);
      
      VersionManager.clearHistory();
      
      setFiles(newFiles);
      setActiveFile(Object.keys(newFiles)[0] || null);
      
      handleSave(newFiles, projectName.trim(), mode);
      VersionManager.saveSnapshot(newFiles, 'Imported project initial state');
      
      setLogs(prev => [...prev, `[SYSTEM] Successfully imported ${Object.keys(newFiles).length} files from GitHub.`]);
    } catch (err: unknown) {
      setLogs(prev => [...prev, `[ERROR] GitHub Import failed: ${(err as Error).message}`]);
    }
  };

  const handleSave = async (targetFiles = files, targetName?: string, targetMode?: string) => {
    const mem = ProjectMemory.getMemory();
    let projectId = mem.project_id;
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(projectId)) {
      const newId = crypto.randomUUID();
      setLogs(prev => [...prev, `[SYSTEM] Legacy project ID converted to Supabase-compatible UUID.`]);
      
      const recent = JSON.parse(localStorage.getItem('nova_recent_projects') || '[]');
      const filtered = recent.filter((p: any) => p.id !== projectId);
      localStorage.setItem('nova_recent_projects', JSON.stringify(filtered));
      
      projectId = newId;
      mem.project_id = newId;
      ProjectMemory.saveMemory(mem);
    }
    let currentName = targetName || (mem as any).project_name || 'Untitled Project';
    if (currentName === 'New Project' && !targetName) {
      const promptName = prompt("Name this project before saving locally:", "My Project");
      if (!promptName) return;
      currentName = promptName.trim();
      mem.project_name = currentName;
    }
    const projectName = currentName;
    const finalMode = targetMode || mem.project_mode || appMode;
    mem.project_mode = finalMode;
    ProjectMemory.saveMemory(mem);

    try {
      await LocalDB.set(STORE_FILES, projectId, targetFiles);
      
      const recent = JSON.parse(localStorage.getItem('nova_recent_projects') || '[]');
      const existingIdx = recent.findIndex((p: any) => p.id === projectId);
      const newProject = {
        id: projectId,
        name: projectName,
        mode: finalMode,
        time: Date.now(),
        source: 'local'
      };
      if (existingIdx >= 0) recent[existingIdx] = newProject;
      else recent.unshift(newProject);
      localStorage.setItem('nova_recent_projects', JSON.stringify(recent));
      localStorage.setItem('nova_appMode', finalMode);
      
      window.dispatchEvent(new CustomEvent('nova-recent-updated'));
      
      if (!targetName) {
        setLogs(prev => [...prev, '[SYSTEM] Project saved locally to IndexedDB.']);
      }
    } catch (err: any) {
      alert(err.message);
      setLogs(prev => [...prev, `[ERROR] Local Save Failed: ${err.message}`]);
    }
  };

    const loadProject = async (projId: string) => {
    try {
      const recentStr = localStorage.getItem('nova_recent_projects');
      let meta: any = null;
      if (recentStr) {
        const recent = JSON.parse(recentStr);
        meta = recent.find((p: any) => p.id === projId);
      }

      setLogs(prev => [...prev, `[SYSTEM] Loading project ${projId} from IndexedDB...`]);
      
      let savedFiles: Record<string, string> | null = null;
      try {
        savedFiles = await LocalDB.get(STORE_FILES, projId);
      } catch (e) {
        console.error("LocalDB Error", e);
      }
      
      if (savedFiles) {
        setFiles(savedFiles);
        if (meta) {
           setAppMode(meta.mode);
           const mem = ProjectMemory.getMemory();
           mem.project_id = projId;
           (mem as any).project_name = meta.name;
           mem.project_mode = meta.mode;
           ProjectMemory.saveMemory(mem);
        }
        
        setShowStartScreen(false);
        setLogs(prev => [...prev, `[SYSTEM] Project loaded successfully.`]);
        
        setReloadChatTrigger(prev => prev + 1);
      } else {
        alert("Project files not found locally.");
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message);
    }
  };

  const deleteProject = async (projId: string) => {
    if (!window.confirm("Are you sure you want to delete this project?")) return;
    try {
      const mem = ProjectMemory.getMemory();
      if (mem.project_id === projId) {
        setFiles({});
        setActiveFile(null);
        setClearChatTrigger(prev => prev + 1);
        ProjectMemory.clearMemory();
        VersionManager.clearHistory();
        try { await LocalDB.remove(STORE_FILES, projId); } catch(e) {}
      }
      
      // Update local storage recent list
      const recent = JSON.parse(localStorage.getItem('nova_recent_projects') || '[]');
      const filtered = recent.filter((p: any) => p.id !== projId);
      localStorage.setItem('nova_recent_projects', JSON.stringify(filtered));
      window.dispatchEvent(new CustomEvent('nova-recent-updated'));
      setLogs(prev => [...prev, `[SYSTEM] Project deleted locally.`]);
      
      if (window.confirm("Do you also want to delete the cloud backup for this project?")) {
        const { success, error } = await CloudSyncManager.deleteCloudBackup(projId);
        if (success) {
          setLogs(prev => [...prev, `[SYSTEM] Cloud backup deleted successfully.`]);
        } else {
           if (error === 'User not authenticated') {
               alert("Please log in to delete cloud backups.");
           } else {
               alert(`Failed to delete cloud backup: ${error}`);
           }
        }
      }
      
      
      window.dispatchEvent(new CustomEvent('nova-recent-updated'));
      setLogs(prev => [...prev, `[SYSTEM] Project deleted successfully.`]);
    } catch (e: any) {
      console.error(e);
      alert(`Error deleting project: ${e.message}`);
    }
  };

    const syncToSupabase = async (projId: string) => {
    if (!window.confirm("Sync this project to Supabase Cloud?")) return;
    try {
      setLogs(prev => [...prev, `[SYSTEM] Syncing project ${projId} to Supabase...`]);
      const savedFiles = await LocalDB.get<Record<string, string>>(STORE_FILES, projId);
      if (!savedFiles) throw new Error("Local project files not found.");
      
      const recent = JSON.parse(localStorage.getItem('nova_recent_projects') || '[]');
      const meta = recent.find((p: any) => p.id === projId);
      if (!meta) throw new Error("Local project metadata not found.");

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) throw new Error("You must be logged in to sync projects.");

      const { error: projError } = await supabase.from('projects').upsert({
        id: projId,
        user_id: user.id,
        name: meta.name,
        app_mode: meta.mode,
        source: 'supabase',
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
      if (projError) throw projError;

      await supabase.from('project_files').delete().eq('project_id', projId);
      const fileInserts = Object.entries(savedFiles).map(([file_path, content]) => ({
        project_id: projId,
        file_path,
        content
      }));
      if (fileInserts.length > 0) {
        const { error: filesError } = await supabase.from('project_files').insert(fileInserts);
        if (filesError) throw filesError;
      }

      meta.source = 'supabase';
      localStorage.setItem('nova_recent_projects', JSON.stringify(recent));
      window.dispatchEvent(new CustomEvent('nova-recent-updated'));
      setLogs(prev => [...prev, `[SYSTEM] Project successfully synced to Supabase.`]);
      alert("Project successfully synced to Supabase!");
    } catch(e: any) {
      console.error(e);
      if (e.code === '42P01') {
         alert("Supabase project tables are not set up yet. Run the project storage SQL in Supabase.");
      } else {
         alert(`Sync failed: ${e.message}`);
      }
    }
  };

  const clearRecent = () => {
    if (!window.confirm("Clear all recent projects? (This only clears the list, files in storage will remain intact unless deleted individually)")) return;
    localStorage.setItem('nova_recent_projects', JSON.stringify([]));
    window.dispatchEvent(new CustomEvent('nova-recent-updated'));
    setLogs(prev => [...prev, `[SYSTEM] Recent projects list cleared.`]);
  };

  const handleNewProject = () => {
    if (!showStartScreen) {
      const choice = prompt("You have unsaved changes. Save before starting a new project?\nType '1' to Save and Continue\nType '2' to Continue Without Saving\nType '3' to Cancel", "1");
      if (choice === '3' || choice === null) return;
      if (choice === '1') handleSave();
    }
    
    setShowNewProjectModal(true);
  };

  const createNewProject = async () => {
    if (!newProjectName.trim()) {
      alert("Project name is required.");
      return;
    }
    
    
    
    
    const mem = ProjectMemory.clearMemory();
    mem.project_name = newProjectName.trim();
    mem.project_mode = newProjectMode;
    mem.framework = newProjectMode;
    ProjectMemory.saveMemory(mem);
    
    VersionManager.clearHistory();
    
    let newFiles: Record<string, string> = {
      "/App.js": `export default function App() {\n  return <div>New ${newProjectMode} Project</div>;\n}`
    };
    
    if (newProjectMode === "Next.js") {
      newFiles = {
        "/pages/index.js": `export default function Home() {\n  return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center font-bold text-2xl">\\n    <div className="flex flex-col items-center gap-4">\\n      <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>\\n      NOVA-RUNNER-OK\\n    </div>\\n  </div>;\n}`,
        "/pages/_app.js": `import '../styles/globals.css';\n\nexport default function App({ Component, pageProps }) {\n  return <Component {...pageProps} />;\n}`,
        "/styles/globals.css": `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nbody { background-color: #0f172a; color: white; }`,
        "/package.json": `{\n  "name": "nova-nextjs",\n  "version": "1.0.0",\n  "private": true,\n  "scripts": {\n    "dev": "next dev",\n    "build": "next build",\n    "start": "next start"\n  },\n  "dependencies": {\n    "next": "14.2.5",\n    "react": "18.3.1",\n    "react-dom": "18.3.1"\n  },\n  "devDependencies": {\n    "autoprefixer": "^10.4.19",\n    "postcss": "^8.4.39",\n    "tailwindcss": "^3.4.7"\n  }\n}`
      };
    } else if (newProjectMode === "React / Vite") {
      newFiles = {
        "/index.html": `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Vite App</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>`,
        "/src/main.jsx": `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App.jsx';\nimport './index.css';\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n);`,
        "/src/App.jsx": `export default function App() {\n  return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center font-bold text-2xl">\\n    <div className="flex flex-col items-center gap-4">\\n      <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>\\n      NOVA-RUNNER-OK\\n    </div>\\n  </div>;\n}`,
        "/src/index.css": `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nbody { background-color: #0f172a; color: white; }`,
        "/package.json": `{\n  "name": "vite-project",\n  "version": "0.0.0",\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build",\n    "preview": "vite preview"\n  },\n  "dependencies": {\n    "react": "^18.3.1",\n    "react-dom": "^18.3.1"\n  },\n  "devDependencies": {\n    "@vitejs/plugin-react": "^4.3.1",\n    "autoprefixer": "^10.4.19",\n    "postcss": "^8.4.39",\n    "tailwindcss": "^3.4.7",\n    "vite": "^5.4.0"\n  }\n}`,
        "/vite.config.js": `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n});`
      };
    } else if (newProjectMode === "Node / Express") {
      newFiles = {
        "/index.js": `const express = require('express');\nconst app = express();\nconst port = process.env.PORT || 3000;\n\napp.get('/', (req, res) => {\n  res.send('<h1>NOVA-RUNNER-OK</h1>');\n});\n\napp.listen(port, () => {\n  console.log(\`Server running on port \${port}\`);\n});`,
        "/package.json": `{\n  "name": "node-express",\n  "version": "1.0.0",\n  "main": "index.js",\n  "scripts": {\n    "start": "node index.js",\n    "dev": "nodemon index.js"\n  },\n  "dependencies": {\n    "express": "^4.19.2"\n  }\n}`
      };
    } else if (newProjectMode === "PHP Native") {
      newFiles = {
        "/index.php": `<?php\n  echo "<h1>NOVA-RUNNER-OK</h1>";\n?>`
      };
    } else if (newProjectMode === "Laravel") {
      newFiles = {
        "/artisan": `// Mock Laravel artisan`,
        "/routes/web.php": `<?php\n\nuse Illuminate\\Support\\Facades\\Route;\n\nRoute::get('/', function () {\n    return '<h1>NOVA-RUNNER-OK</h1>';\n});`
      };
    }
    
    setFiles(newFiles);
    setAppMode(newProjectMode);
    setActiveFile("/App.js");
    setLogs(["[SYSTEM] Created new clean project."]);
    
    VersionManager.saveSnapshot(newFiles, 'Initial Setup');
    handleSave(newFiles, newProjectName.trim(), newProjectMode);
    
    setNewProjectName("");
    setShowNewProjectModal(false);
    setShowStartScreen(false);
  };


  useEffect(() => {
    const initStorage = async () => {
      await VersionManager.init();
      await ProjectMemory.init();
      
      let loadedFiles = null;
      
      const savedMode = localStorage.getItem('nova_appMode');
      const savedTheme = localStorage.getItem('nova_theme');
      
      if (savedMode) setAppMode(savedMode);
      if (savedTheme) setTheme(savedTheme as any);
      
      setIsHydrated(true);
    };
    initStorage();
  }, []);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('nova_appMode', appMode);
      localStorage.setItem('nova_theme', theme);
    }
  }, [appMode, theme, isHydrated]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'BROWSER_ERROR') {
        setLogs(prev => [...prev, `[BROWSER RUNTIME ERROR] ${e.data.payload}`]);
      }
      if (e.data && e.data.type === 'NOVA_ELEMENT_CLICK') {
        const el = e.data.payload;
        const descriptor = el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ').join('.')}` : el.tag;
        const textHint = el.text ? ` containing "${el.text}"` : '';
        const promptTarget = `Make changes to the <${el.tag}> element${descriptor ? ` (${descriptor})` : ''}${textHint}. `;
        
        window.dispatchEvent(new CustomEvent('nova-set-prompt', { detail: promptTarget }));
        setMobileTab('chat');
        setLogs(prev => [...prev, `[SYSTEM] Targeted element <${el.tag}> for AI editing.`]);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    // Send files to the sync bridge for the local CLI
    if (Object.keys(files).length > 0) {
      try {
        const mem = ProjectMemory.getMemory();
        if (mem.project_id) {
          fetch('/api/sync/bridge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: mem.project_id, files })
          }).catch(() => {});
        }
      } catch (e) {}
    }
  }, [files]);

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
      const aiModel = localStorage.getItem('nova_ai_model') || 'default';
      const apiKey = aiModel !== 'default' ? (localStorage.getItem(`nova_api_key_${aiModel}`) || '') : '';

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, currentFiles: currentFilesState, isAutoHeal, aiModel, apiKey })
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
    let mode = "Static Website";
    if (newFiles['/artisan'] || (newFiles['/composer.json'] && newFiles['/composer.json'].includes('laravel/framework')) || newFiles['/public/index.php']) {
       mode = "Laravel";
    } else if (newFiles['/next.config.js'] || newFiles['/next.config.mjs'] || (newFiles['/package.json'] && newFiles['/package.json'].includes('"next"'))) {
       mode = "Next.js / SSR";
    } else if (newFiles['/package.json'] && (newFiles['/package.json'].includes('"react"') || newFiles['/package.json'].includes('"vite"')) || newFiles['/index.html']) {
       mode = "React / Vite";
    } else if (newFiles['/package.json'] && newFiles['/package.json'].includes('"express"')) {
       mode = "Node / Express";
    } else if (newFiles['/index.php']) {
       mode = "PHP";
    }
    
    setAppMode(mode);
    setLogs(prev => [...prev, `[SYSTEM] Auto-detected ${mode} environment.`]);
    return mode;
  };

  const handleClearFiles = async () => {
    if (!window.confirm("Clear current workspace? This will not delete saved projects.")) return;
    setFiles({});
    setActiveFile(null);
    setClearChatTrigger(prev => prev + 1);
    setLogs(prev => [...prev, `[SYSTEM] Workspace cleared. Saved projects were not deleted.`]);
    ProjectMemory.clearMemory();
    VersionManager.clearHistory();
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    let defaultName = file.name.replace(/\.zip$/i, '');
    let projectName = prompt(`Name this imported project (ZIP):`, defaultName);
    if (!projectName) {
      e.target.value = '';
      return;
    }
    
    setLogs(prev => [...prev, "[IMPORT] Reading ZIP archive..."]);
    try {
      const newFiles = await processZipData(file);
      const mode = autoDetectAndSetMode(newFiles);
      
      const mem = ProjectMemory.clearMemory();
      mem.project_name = projectName.trim();
      mem.project_mode = mode;
      mem.framework = mode;
      ProjectMemory.saveMemory(mem);
      
      VersionManager.clearHistory();
      
      setFiles(newFiles);
      setActiveFile(Object.keys(newFiles)[0] || null);
      
      handleSave(newFiles, projectName.trim(), mode);
      VersionManager.saveSnapshot(newFiles, 'Imported project initial state');
      
      setLogs(prev => [...prev, `[SYSTEM] Successfully imported ${Object.keys(newFiles).length} files from ZIP.`]);
    } catch (err) {
      setLogs(prev => [...prev, `[ERROR] Failed to parse ZIP: ${(err as Error).message}`]);
    }
    e.target.value = '';
  };

  const handleTerminalCommand = async (cmd: string) => {
    setLogs(prev => [...prev, `> ${cmd}`]);
    
    if (cmd.trim().toLowerCase() === 'nova heal') {
       // Look for the most recent error
       const lastError = logs.slice().reverse().find(l => l.includes('[ERROR]') || l.includes('[BROWSER RUNTIME ERROR]') || l.toLowerCase().includes('error:') || l.includes('ERR!'));
       if (!lastError) {
         setLogs(prev => [...prev, `[SYSTEM] No recent errors found in terminal to heal.`]);
         return;
       }
       handleSelfHeal(lastError);
       return;
    }

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
    
    let defaultName = "Imported Folder";
    if (fileList[0].webkitRelativePath) {
      defaultName = fileList[0].webkitRelativePath.split('/')[0] || defaultName;
    }
    
    let projectName = prompt(`Name this imported project (Folder):`, defaultName);
    if (!projectName) {
      e.target.value = '';
      return;
    }
    
    setLogs(prev => [...prev, "[IMPORT] Mapping local folder structure..."]);
    const newFiles: Record<string, string> = {};
    let count = 0;
    
    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const path = file.webkitRelativePath;
        if (path.includes('node_modules') || path.includes('.git') || path.includes('.next')) continue;
        
        const pathParts = path.split('/');
        pathParts.shift(); 
        const relativePath = '/' + pathParts.join('/');
        
        if (relativePath !== '/') {
          const text = await file.text();
          newFiles[relativePath] = text;
          count++;
        }
      }
      
      const mode = autoDetectAndSetMode(newFiles);
      
      const mem = ProjectMemory.clearMemory();
      mem.project_name = projectName.trim();
      mem.project_mode = mode;
      mem.framework = mode;
      ProjectMemory.saveMemory(mem);
      
      VersionManager.clearHistory();
      
      setFiles(newFiles);
      setActiveFile(Object.keys(newFiles)[0] || null);
      
      handleSave(newFiles, projectName.trim(), mode);
      VersionManager.saveSnapshot(newFiles, 'Imported project initial state');
      
      setLogs(prev => [...prev, `[SYSTEM] Successfully imported ${count} files from Folder.`]);
    } catch (err) {
      setLogs(prev => [...prev, `[ERROR] Folder import failed: ${(err as Error).message}`]);
    }
    e.target.value = '';
  };

  if (showStartScreen) {
    const recentStr = typeof window !== 'undefined' ? localStorage.getItem('nova_recent_projects') : '[]';
    const recent = recentStr ? JSON.parse(recentStr) : [];
    
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-screen bg-slate-950 font-sans text-slate-300 relative overflow-hidden">
        <div className="w-16 h-16 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-8">
          <span className="text-white font-bold text-2xl">NV</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Welcome to NovaAI</h1>
        <p className="text-slate-400 mb-8 text-center max-w-md">Start a new project or select an existing one to continue building your application.</p>
        
        <div className="flex flex-wrap items-center justify-center gap-4 mb-10 w-full max-w-md">
          <button onClick={handleNewProject} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2">
            <Plus className="w-5 h-5" /> Start New Project
          </button>
          <label className="flex-1 cursor-pointer py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2">
            <FolderUp className="w-5 h-5" /> Import Folder
            {/* @ts-expect-error */}
            <input type="file" webkitdirectory="true" directory="true" className="hidden" onChange={(e) => { handleFolderUpload(e); setShowStartScreen(false); }} />
          </label>
        </div>
        
        {recent.length > 0 && (
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><History className="w-4 h-4" /> Recent Projects</h2>
            </div>
            <div className="max-h-[300px] overflow-y-auto p-2 flex flex-col gap-2">
              {recent.map((p: any) => (
                <div key={p.id} className="flex items-center gap-2">
                  <button onClick={() => loadProject(p.id)} className="flex-1 text-left p-3 rounded-lg hover:bg-slate-800 border border-slate-800 transition-colors flex items-center justify-between">
                    <div>
                      <span className="block text-sm font-bold text-slate-200">{p.name}</span>
                      <span className="block text-xs text-slate-500 mt-1">{p.mode}</span>
                    </div>
                    <Play className="w-4 h-4 text-indigo-400" />
                  </button>
                  {p.source !== 'supabase' && <button onClick={() => syncToSupabase(p.id)} className="p-3 bg-slate-900 border border-slate-800 text-slate-500 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors" title="Sync to Supabase"><DownloadCloud className="w-4 h-4" /></button>}
                  <button onClick={() => deleteProject(p.id)} className="p-3 bg-slate-900 border border-slate-800 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors" title="Delete Project">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {showNewProjectModal && (
          <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-4 border-b border-slate-800 bg-slate-950">
                <h2 className="text-lg font-bold text-white">Start New Project</h2>
              </div>
              <div className="p-6 flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Project Name</label>
                  <input 
                    type="text" 
                    value={newProjectName} 
                    onChange={e => setNewProjectName(e.target.value)} 
                    placeholder="e.g. My SaaS App" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500" 
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">App Mode</label>
                  <select 
                    value={newProjectMode} 
                    onChange={e => setNewProjectMode(e.target.value)} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500 cursor-pointer appearance-none"
                  >
                    {["Auto Detect", "React / Vite", "Next.js", "Node / Express", "PHP", "Laravel", "Static Website"].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-end gap-3">
                <button onClick={() => setShowNewProjectModal(false)} className="px-4 py-2 rounded text-sm font-bold text-slate-400 hover:text-white transition-colors">Cancel</button>
                <button onClick={createNewProject} className="px-4 py-2 rounded text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all">Create Project</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-[100dvh] w-screen max-w-full font-sans antialiased tracking-tight overflow-hidden relative transition-colors duration-500 ${currentTheme.appBg}`}>
      {/* Ambient Deep Space Glows (God-Tier) */}
      {theme === 'godlike' && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-80">
          <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-600/20 blur-[140px] rounded-full mix-blend-screen animate-pulse duration-[10000ms]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-fuchsia-600/20 blur-[140px] rounded-full mix-blend-screen animate-pulse duration-[12000ms]" />
          <div className="absolute top-[20%] right-[10%] w-[30vw] h-[30vw] bg-cyan-500/10 blur-[100px] rounded-full mix-blend-screen animate-pulse duration-[8000ms]" />
        </div>
      )}

      {/* iOS-Style Vibrant Mesh Gradient (Vibrant Mode) */}
      {theme === 'day' && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-60">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-rose-600/20 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-700/30 blur-[120px] rounded-full" />
          <div className="absolute top-[20%] right-[-20%] w-[50%] h-[50%] bg-amber-600/15 blur-[120px] rounded-full" />
          <div className="absolute bottom-[20%] left-[-20%] w-[40%] h-[40%] bg-purple-700/30 blur-[120px] rounded-full" />
          <div className="absolute top-[40%] left-[30%] w-[30%] h-[30%] bg-cyan-600/15 blur-[100px] rounded-full" />
        </div>
      )}

      <BuilderTopBar 
        onToggleRight={() => {}} 
        onToggleBottom={() => {}} 
        onOpenVersions={() => setViewMode('versions')}
        appMode={appMode}
        setAppMode={handleModeChange}
        userEmail={userEmail}
        onLoadProject={loadProject}
        onDeleteProject={deleteProject}
        onClearRecent={clearRecent}
        theme={theme}
        setTheme={(t) => setTheme(t as 'godlike' | 'night' | 'day')}
      />
      
      <div className="flex flex-1 overflow-hidden relative min-h-0 min-w-0 w-full z-10 p-2 md:p-4 gap-2 md:gap-4">
        
        {/* Left Column: Chat */}
        <div className={`absolute inset-0 md:relative w-full md:w-[320px] lg:w-[380px] border ${currentTheme.border} rounded-2xl flex-col z-20 ${currentTheme.shadow} ${currentTheme.panelBg} backdrop-blur-2xl shrink-0 min-h-0 min-w-0 max-w-full transition-all duration-300 overflow-hidden ${mobileTab === 'chat' ? 'flex' : 'hidden md:flex'}`}>
          <ChatPanel 
            files={files} 
            setFiles={setFiles} 
            setLogs={setLogs} 
            clearChatTrigger={clearChatTrigger} 
            reloadChatTrigger={reloadChatTrigger}
            appMode={appMode}
          />
        </div>
      
        {/* Center Column: Files, Editor, Terminal */}
        <div className={`absolute inset-0 md:relative flex-1 flex-col z-10 bg-transparent min-h-0 min-w-0 ${mobileTab === 'files' || mobileTab === 'editor' || mobileTab === 'tools' || mobileTab === 'terminal' ? 'flex' : 'hidden md:flex'}`}>
          <div className={`flex-1 flex flex-col md:flex-row min-h-0 min-w-0 w-full border ${currentTheme.border} rounded-2xl ${currentTheme.shadow} ${currentTheme.centerBg} backdrop-blur-3xl overflow-hidden transition-colors duration-500`}>
            {/* File Explorer Sidebar */}
            <div className={`absolute inset-0 md:relative w-full md:w-[260px] lg:w-[300px] border-r ${currentTheme.border} bg-transparent flex-col z-20 shrink-0 min-h-0 min-w-0 max-w-full transition-all duration-300 ${mobileTab === 'files' ? 'flex' : 'hidden md:flex'}`}>
            <div className={`p-2 border-b ${currentTheme.border} flex flex-wrap gap-2 md:gap-3 items-center min-w-0 bg-transparent`}>
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
                <button onClick={handleSaveToCloud} disabled={isCloudSaving} className={`text-blue-500 hover:text-blue-400 ${isCloudSaving ? 'animate-pulse' : ''}`} title="Save to Cloud">
                  <Cloud className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setShowCloudModal(true)} className="text-slate-400 hover:text-slate-300" title="Cloud Projects">
                  <History className="w-3.5 h-3.5" />
                </button>
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
                <button onClick={() => handleSave()} className="text-slate-500 hover:text-indigo-400" title="Save Project">
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
          <div className={`absolute inset-0 md:relative flex-1 bg-transparent flex-col z-10 min-h-0 min-w-0 ${mobileTab === 'editor' || mobileTab === 'tools' ? 'flex' : 'hidden md:flex'}`}>
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
                <div className={`h-8 border-b ${currentTheme.border} bg-transparent backdrop-blur-sm flex items-center justify-between px-4 text-xs font-mono ${currentTheme.text}`}>
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
        {/* Terminal / Logs Panel */}
        <div className={`absolute inset-0 md:relative md:h-[250px] border ${currentTheme.border} rounded-2xl ${currentTheme.shadow} ${currentTheme.panelBg} backdrop-blur-3xl flex-col z-30 shrink-0 min-h-0 min-w-0 max-w-full mt-2 md:mt-4 overflow-hidden transition-colors duration-500 ${mobileTab === 'terminal' ? 'flex' : 'hidden md:flex'}`}>
           <LogsPanel logs={logs} onCommand={handleTerminalCommand} onSelfHeal={handleSelfHeal} />
        </div>
      </div>
      
      {/* Right Column: Preview */}
      <div className={`absolute inset-0 md:relative w-full md:w-[35%] lg:w-[45%] flex-col border ${currentTheme.border} rounded-2xl ${currentTheme.panelBg} backdrop-blur-3xl z-30 ${currentTheme.shadow} shrink-0 min-h-0 min-w-0 max-w-full transition-all duration-500 overflow-hidden ${mobileTab === 'preview' ? 'flex translate-x-0' : 'hidden md:flex'}`}>
        <div className={`h-12 border-b ${currentTheme.border} flex items-center px-4 justify-between bg-transparent shrink-0 overflow-x-auto whitespace-nowrap`}>
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
        <div className="flex-1 relative overflow-hidden bg-transparent">
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
      
      {/* Mobile Tab Bar - Premium Floating Pill */}
      <div className={`md:hidden absolute bottom-6 left-4 right-4 h-16 ${currentTheme.mobilePillBg} backdrop-blur-2xl border ${currentTheme.border} rounded-2xl flex items-center justify-between px-2 z-[100] ${currentTheme.shadow} transition-colors duration-500`}>
        <button onClick={() => setMobileTab('chat')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${mobileTab === 'chat' ? 'text-indigo-500 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'text-slate-500'}`}>
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] font-medium">Chat</span>
        </button>
        <button onClick={() => setMobileTab('files')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${mobileTab === 'files' ? 'text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]' : 'text-slate-500 hover:text-slate-300'}`}>
          <Folder className="w-5 h-5" />
          <span className="text-[10px] font-medium">Files</span>
        </button>
        <button onClick={() => { setMobileTab('editor'); setViewMode('code'); }} className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${mobileTab === 'editor' ? 'text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]' : 'text-slate-500 hover:text-slate-300'}`}>
          <Code className="w-5 h-5" />
          <span className="text-[10px] font-medium">Code</span>
        </button>
        <button onClick={() => { setMobileTab('tools'); setViewMode('tools'); }} className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${mobileTab === 'tools' ? 'text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]' : 'text-slate-500 hover:text-slate-300'}`}>
          <Settings2 className="w-5 h-5" />
          <span className="text-[10px] font-medium">Tools</span>
        </button>
        <button onClick={() => setMobileTab('preview')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${mobileTab === 'preview' ? 'text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]' : 'text-slate-500 hover:text-slate-300'}`}>
          <Play className="w-5 h-5" />
          <span className="text-[10px] font-medium">Preview</span>
        </button>
      </div>
      </div>

      {showCloudModal && (
        <CloudProjectsModal 
          onClose={() => setShowCloudModal(false)}
          onRestore={(data) => {
            setFiles(data.files || {});
            setActiveFile(Object.keys(data.files || {})[0] || null);
            setAppMode(data.workspace?.active_mode || 'Auto Detect');
            setReloadChatTrigger(prev => prev + 1);
            setLogs(prev => [...prev, "[SYSTEM] Workspace restored from cloud."]);
          }}
        />
      )}

      {/* Floating Nova Guide Assistant */}
      <NovaGuide />
    </div>
  );
}

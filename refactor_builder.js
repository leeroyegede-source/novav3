const fs = require('fs');
let code = fs.readFileSync('src/components/BuilderLayout.tsx', 'utf8');

// 1. Add new state variables
code = code.replace(/const \[mobileTab, setMobileTab\] = useState.*?;/s, match => match + '\n  const [showStartScreen, setShowStartScreen] = useState(true);\n  const [showNewProjectModal, setShowNewProjectModal] = useState(false);\n  const [newProjectName, setNewProjectName] = useState("");\n  const [newProjectMode, setNewProjectMode] = useState("Next.js");');

// 2. Rewrite handleSave
code = code.replace(/const handleSave = \(\) => \{[\s\S]*?alert\('Project saved successfully!'\);\s*\}\s*catch\s*\(err\)\s*\{\s*setLogs\(prev => \[\.\.\.prev, '\[ERROR\] Failed to save project metadata\.'\]\);\s*\}\s*\};/s, `const handleSave = (targetFiles = files, targetName?: string, targetMode?: string) => {
    VersionManager.saveSnapshot(targetFiles, 'Manual Save');
    
    const mem = ProjectMemory.getMemory();
    const projectId = mem.project_id;
    const projectName = targetName || (mem as any).project_name || 'Untitled Project';
    const finalMode = targetMode || mem.project_mode || appMode;

    LocalDB.set(STORE_FILES, projectId, targetFiles).catch(console.error);
    
    localStorage.setItem('nova_appMode', finalMode);
    localStorage.setItem('nova_files', JSON.stringify(targetFiles));
    LocalDB.set(STORE_FILES, 'nova_active_files', targetFiles).catch(console.error);
    
    setLogs(prev => [...prev, '[SYSTEM] Project saved manually to IndexedDB.']);
    
    try {
      const recent = JSON.parse(localStorage.getItem('nova_recent_projects') || '[]');
      const existingIdx = recent.findIndex((p: any) => p.id === projectId);
      const newProject = {
        id: projectId,
        name: projectName,
        mode: finalMode,
        time: Date.now(),
        source: 'Saved Locally'
      };
      if (existingIdx >= 0) recent[existingIdx] = newProject;
      else recent.unshift(newProject);
      localStorage.setItem('nova_recent_projects', JSON.stringify(recent));
      window.dispatchEvent(new CustomEvent('nova-recent-updated'));
      if (!targetName) alert('Project saved successfully!');
    } catch (err) {
      setLogs(prev => [...prev, '[ERROR] Failed to save project metadata.']);
    }
  };`);

// 3. Update loadProject
code = code.replace(/setLogs\(prev => \[\.\.\.prev, \`\[SYSTEM\] Project loaded successfully\.\`\]\);/s, `await VersionManager.loadProject(projId);
        setShowStartScreen(false);
        setLogs(prev => [...prev, \`[SYSTEM] Project loaded successfully.\`]);`);

// 4. Update handleNewProject
code = code.replace(/const handleNewProject = \(\) => \{[\s\S]*?VersionManager\.saveSnapshot\(newFiles, 'Initial Setup'\);\s*\};/s, `const handleNewProject = () => {
    if (!showStartScreen) {
      const choice = prompt("You have unsaved changes. Save before starting a new project?\\nType '1' to Save and Continue\\nType '2' to Continue Without Saving\\nType '3' to Cancel", "1");
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
    
    localStorage.removeItem('nova_files');
    await LocalDB.remove(STORE_FILES, 'nova_active_files');
    
    const mem = ProjectMemory.clearMemory();
    mem.project_name = newProjectName.trim();
    mem.project_mode = newProjectMode;
    mem.framework = newProjectMode;
    ProjectMemory.saveMemory(mem);
    
    VersionManager.clearHistory();
    
    const newFiles = {
      "/App.js": \`export default function App() {\\n  return <div>New \${newProjectMode} Project</div>;\\n}\`
    };
    
    setFiles(newFiles);
    setAppMode(newProjectMode);
    setActiveFile("/App.js");
    setLogs(["[SYSTEM] Created new clean project."]);
    
    VersionManager.saveSnapshot(newFiles, 'Initial Setup');
    handleSave(newFiles, newProjectName.trim(), newProjectMode);
    
    setNewProjectName("");
    setShowNewProjectModal(false);
    setShowStartScreen(false);
  };`);

// 5. Update handleClearFiles
code = code.replace(/const handleClearFiles = \(\) => \{[\s\S]*?\}\s*;/s, `const handleClearFiles = async () => {
    if (!window.confirm("Are you sure you want to clear the active workspace? (This will clear active files and versions, but saved projects in storage will remain intact)")) return;
    setFiles({ "/App.js": "" });
    setActiveFile("/App.js");
    setClearChatTrigger(prev => prev + 1);
    setLogs(prev => [...prev, \`[SYSTEM] Workspace cleared. Clean slate ready for \${appMode}.\`]);
    
    VersionManager.clearHistory();
    ProjectMemory.clearMemory();
    await LocalDB.remove(STORE_FILES, 'nova_active_files');
    localStorage.removeItem('nova_files');
  };`);

// 6. Add Start Screen UI
code = code.replace(/return \(\s*<div className="flex flex-col h-screen w-screen/s, `if (showStartScreen) {
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
    <div className="flex flex-col h-screen w-screen`);

fs.writeFileSync('src/components/BuilderLayout.tsx', code);
console.log('Done replacement');

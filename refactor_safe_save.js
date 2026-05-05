const fs = require('fs');

let code = fs.readFileSync('src/components/BuilderLayout.tsx', 'utf8');

// Replace handleSave
code = code.replace(/const handleSave = async \(targetFiles = files, targetName\?: string, targetMode\?: string\) => \{[\s\S]*?alert\(\`Supabase Save Failed: \$\{err\.message\}\`\);\s*\}\s*\};/s, `const handleSave = async (targetFiles = files, targetName?: string, targetMode?: string) => {
    const mem = ProjectMemory.getMemory();
    const projectId = mem.project_id;
    const projectName = targetName || (mem as any).project_name || 'Untitled Project';
    const finalMode = targetMode || mem.project_mode || appMode;

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    
    let source = 'indexeddb';
    let saveError = null;

    if (user) {
      setLogs(prev => [...prev, '[SYSTEM] Saving to Supabase cloud...']);
      try {
        const { error: projError } = await supabase.from('projects').upsert({
          id: projectId,
          user_id: user.id,
          name: projectName,
          app_mode: finalMode,
          source: 'supabase',
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
        
        if (projError) throw projError;

        await supabase.from('project_files').delete().eq('project_id', projectId);
        
        const fileInserts = Object.entries(targetFiles).map(([file_path, content]) => ({
          project_id: projectId,
          file_path,
          content
        }));
        
        if (fileInserts.length > 0) {
          const { error: filesError } = await supabase.from('project_files').insert(fileInserts);
          if (filesError) throw filesError;
        }

        await supabase.from('project_memory').upsert({
          project_id: projectId,
          memory_summary: mem.memory_summary || '',
          updated_at: new Date().toISOString()
        }, { onConflict: 'project_id' });

        source = 'supabase';
      } catch (err: any) {
        saveError = err.message;
        setLogs(prev => [...prev, \`[ERROR] Supabase Save Failed: \${err.message}\`]);
      }
    } else {
      setLogs(prev => [...prev, '[SYSTEM] Not logged in to Supabase. Saving locally...']);
    }

    if (source === 'indexeddb') {
      try {
        await LocalDB.set(STORE_FILES, projectId, targetFiles);
        setLogs(prev => [...prev, '[SYSTEM] Saved to local IndexedDB.']);
      } catch(e) {
        console.error(e);
      }
    }

    VersionManager.saveSnapshot(targetFiles, 'Manual Save');

    const recent = JSON.parse(localStorage.getItem('nova_recent_projects') || '[]');
    const existingIdx = recent.findIndex((p: any) => p.id === projectId);
    const newProject = {
      id: projectId,
      name: projectName,
      mode: finalMode,
      time: Date.now(),
      source: source
    };
    if (existingIdx >= 0) recent[existingIdx] = newProject;
    else recent.unshift(newProject);
    localStorage.setItem('nova_recent_projects', JSON.stringify(recent));
    localStorage.setItem('nova_appMode', finalMode);
    
    window.dispatchEvent(new CustomEvent('nova-recent-updated'));
    
    if (!targetName) {
      if (source === 'supabase') {
        setLogs(prev => [...prev, '[SYSTEM] Project saved successfully to Supabase!']);
        alert('Project saved successfully to Cloud!');
      } else {
        alert(saveError ? \`Saved locally. Supabase sync failed: \${saveError}\` : 'Saved locally to IndexedDB.');
      }
    }
  };`);

// Replace loadProject
code = code.replace(/const loadProject = async \(projId: string\) => \{[\s\S]*?alert\(\`Error loading project from Supabase: \$\{e\.message\}\`\);\s*\}\s*\};/s, `const loadProject = async (projId: string) => {
    try {
      const recentStr = localStorage.getItem('nova_recent_projects');
      let meta: any = null;
      if (recentStr) {
        const recent = JSON.parse(recentStr);
        meta = recent.find((p: any) => p.id === projId);
      }

      const source = meta?.source || 'indexeddb';
      setLogs(prev => [...prev, \`[SYSTEM] Loading project \${projId} from \${source}...\`]);
      
      let savedFiles: Record<string, string> | null = null;
      
      if (source === 'supabase') {
        const { data: filesData, error } = await supabase
          .from('project_files')
          .select('file_path, content')
          .eq('project_id', projId);

        if (error) {
           if (error.code === '42P01') {
              throw new Error("Supabase project tables are not set up yet. Run the project storage SQL in Supabase.");
           }
           throw error;
        }
        
        if (filesData && filesData.length > 0) {
          savedFiles = {};
          filesData.forEach(f => {
            savedFiles![f.file_path] = f.content;
          });
        }
      } else {
        savedFiles = await LocalDB.get<Record<string, string>>(STORE_FILES, projId);
      }
      
      if (savedFiles) {
        setFiles(savedFiles);
        if (meta) {
           setAppMode(meta.mode);
           const mem = ProjectMemory.getMemory();
           mem.project_id = projId;
           (mem as any).project_name = meta.name;
           mem.project_mode = meta.mode;
           
           if (source === 'supabase') {
             supabase.from('project_memory').select('memory_summary').eq('project_id', projId).single().then(({ data }) => {
                if (data && data.memory_summary) mem.memory_summary = data.memory_summary;
                ProjectMemory.saveMemory(mem);
             }).catch(() => ProjectMemory.saveMemory(mem));
           } else {
             ProjectMemory.saveMemory(mem);
           }
        }
        
        await VersionManager.loadProject(projId);
        setShowStartScreen(false);
        setLogs(prev => [...prev, \`[SYSTEM] Project loaded successfully.\`]);
      } else {
        alert("Project files not found.");
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message);
    }
  };`);

// Replace deleteProject
code = code.replace(/const deleteProject = async \(projId: string\) => \{[\s\S]*?alert\(\`Error deleting project: \$\{e\.message\}\`\);\s*\}\s*\};/s, `const deleteProject = async (projId: string) => {
    if (!window.confirm("Are you sure you want to delete this project?")) return;
    try {
      const mem = ProjectMemory.getMemory();
      if (mem.project_id === projId) {
        alert("You cannot delete the currently open project. Please start a new project first.");
        return;
      }
      
      const recent = JSON.parse(localStorage.getItem('nova_recent_projects') || '[]');
      const meta = recent.find((p: any) => p.id === projId);
      const source = meta?.source || 'unknown';
      
      if (source === 'supabase') {
        const { error } = await supabase.from('projects').delete().eq('id', projId);
        if (error) {
           if (error.code === '42P01') {
              alert("Supabase project tables are not set up yet. Run the project storage SQL in Supabase.");
           } else {
              throw error;
           }
        }
      } else if (source === 'indexeddb' || source === 'local' || source === 'unknown') {
        await LocalDB.remove(STORE_FILES, projId);
        // Also attempt supabase delete if unknown just in case
        if (source === 'unknown') supabase.from('projects').delete().eq('id', projId).catch(()=>{});
      }
      
      const filtered = recent.filter((p: any) => p.id !== projId);
      localStorage.setItem('nova_recent_projects', JSON.stringify(filtered));
      
      window.dispatchEvent(new CustomEvent('nova-recent-updated'));
      setLogs(prev => [...prev, \`[SYSTEM] Project deleted successfully.\`]);
    } catch (e: any) {
      console.error(e);
      alert(\`Error deleting project: \${e.message}\`);
    }
  };`);

// Sync to Supabase function
const syncToSupabaseStr = `  const syncToSupabase = async (projId: string) => {
    if (!window.confirm("Sync this project to Supabase Cloud?")) return;
    try {
      setLogs(prev => [...prev, \`[SYSTEM] Syncing project \${projId} to Supabase...\`]);
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
      setLogs(prev => [...prev, \`[SYSTEM] Project successfully synced to Supabase.\`]);
      alert("Project successfully synced to Supabase!");
    } catch(e: any) {
      console.error(e);
      if (e.code === '42P01') {
         alert("Supabase project tables are not set up yet. Run the project storage SQL in Supabase.");
      } else {
         alert(\`Sync failed: \${e.message}\`);
      }
    }
  };`;

code = code.replace(/const clearRecent = \(\) => \{/, `${syncToSupabaseStr}\n\n  const clearRecent = () => {`);

// Add sync button to Recent list UI
code = code.replace(/<button onClick=\{\(\) => deleteProject\(p\.id\)\} className="p-3 bg-slate-900 border border-slate-800 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors" title="Delete Project">/g, `{p.source !== 'supabase' && <button onClick={() => syncToSupabase(p.id)} className="p-3 bg-slate-900 border border-slate-800 text-slate-500 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors" title="Sync to Supabase"><DownloadCloud className="w-4 h-4" /></button>}\n                  <button onClick={() => deleteProject(p.id)} className="p-3 bg-slate-900 border border-slate-800 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors" title="Delete Project">`);

fs.writeFileSync('src/components/BuilderLayout.tsx', code);
console.log("Updated BuilderLayout for safe storage sync.");

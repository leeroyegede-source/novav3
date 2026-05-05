const fs = require('fs');

let code = fs.readFileSync('src/components/BuilderLayout.tsx', 'utf8');

// 1. handleSave
code = code.replace(/const handleSave = async \(targetFiles = files, targetName\?: string, targetMode\?: string\) => \{[\s\S]*?\} else \{\s*alert\(saveError \? `Saved locally\. Supabase sync failed: \$\{saveError\}` : 'Saved locally to IndexedDB\.'\);\s*\}\s*\}\s*\};/s, `const handleSave = async (targetFiles = files, targetName?: string, targetMode?: string) => {
    const mem = ProjectMemory.getMemory();
    const projectId = mem.project_id;
    const projectName = targetName || (mem as any).project_name || 'Untitled Project';
    const finalMode = targetMode || mem.project_mode || appMode;

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    
    if (!user) {
      alert("Please log in to save projects");
      setLogs(prev => [...prev, '[SYSTEM] Not logged in to Supabase. Cannot save.']);
      return;
    }

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
      
      if (projError) {
        if (projError.code === '42P01') {
          throw new Error("Supabase project storage tables are missing. Run SQL setup.");
        }
        throw projError;
      }

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

      const versionId = Math.random().toString(36).substring(7);
      await supabase.from('project_versions').insert({
        id: versionId,
        project_id: projectId,
        files: targetFiles,
        message: 'Manual Save',
        preview_state: 'pending'
      }).catch(() => {}); // ignore version failure if table not perfectly setup

      const recent = JSON.parse(localStorage.getItem('nova_recent_projects') || '[]');
      const existingIdx = recent.findIndex((p: any) => p.id === projectId);
      const newProject = {
        id: projectId,
        name: projectName,
        mode: finalMode,
        time: Date.now(),
        source: 'supabase'
      };
      if (existingIdx >= 0) recent[existingIdx] = newProject;
      else recent.unshift(newProject);
      localStorage.setItem('nova_recent_projects', JSON.stringify(recent));
      localStorage.setItem('nova_appMode', finalMode);
      
      window.dispatchEvent(new CustomEvent('nova-recent-updated'));
      
      if (!targetName) {
        setLogs(prev => [...prev, '[SYSTEM] Project saved successfully to Supabase!']);
        alert('Project saved to Supabase');
      }
    } catch (err: any) {
      alert(err.message);
      setLogs(prev => [...prev, \`[ERROR] Supabase Save Failed: \${err.message}\`]);
    }
  };`);


// 2. loadProject
code = code.replace(/const loadProject = async \(projId: string\) => \{[\s\S]*?alert\(e\.message\);\s*\}\s*\};/s, `const loadProject = async (projId: string) => {
    try {
      const recentStr = localStorage.getItem('nova_recent_projects');
      let meta: any = null;
      if (recentStr) {
        const recent = JSON.parse(recentStr);
        meta = recent.find((p: any) => p.id === projId);
      }

      setLogs(prev => [...prev, \`[SYSTEM] Loading project \${projId} from supabase...\`]);
      
      let savedFiles: Record<string, string> | null = null;
      
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
      
      if (savedFiles) {
        setFiles(savedFiles);
        if (meta) {
           setAppMode(meta.mode);
           const mem = ProjectMemory.getMemory();
           mem.project_id = projId;
           (mem as any).project_name = meta.name;
           mem.project_mode = meta.mode;
           
           supabase.from('project_memory').select('memory_summary').eq('project_id', projId).single().then(({ data, error }) => {
              if (!error && data && data.memory_summary) mem.memory_summary = data.memory_summary;
              ProjectMemory.saveMemory(mem);
           });
        }
        
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


// 3. deleteProject
code = code.replace(/const deleteProject = async \(projId: string\) => \{[\s\S]*?alert\(`Error deleting project: \$\{e\.message\}`\);\s*\}\s*\};/s, `const deleteProject = async (projId: string) => {
    if (!window.confirm("Are you sure you want to delete this project?")) return;
    try {
      const mem = ProjectMemory.getMemory();
      if (mem.project_id === projId) {
        alert("You cannot delete the currently open project. Please start a new project first.");
        return;
      }
      
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) {
        alert("Please log in to delete projects");
        return;
      }

      const { error } = await supabase.from('projects').delete().match({ id: projId, user_id: user.id });
      if (error) {
         if (error.code === '42P01') {
            alert("Supabase project tables are not set up yet.");
         } else {
            throw error;
         }
      }
      
      const recent = JSON.parse(localStorage.getItem('nova_recent_projects') || '[]');
      const filtered = recent.filter((p: any) => p.id !== projId);
      localStorage.setItem('nova_recent_projects', JSON.stringify(filtered));
      
      window.dispatchEvent(new CustomEvent('nova-recent-updated'));
      setLogs(prev => [...prev, \`[SYSTEM] Project deleted successfully.\`]);
    } catch (e: any) {
      console.error(e);
      alert(\`Error deleting project: \${e.message}\`);
    }
  };`);


// 4. remove local storage/idb file saving
code = code.replace(/localStorage\.setItem\('nova_files', JSON\.stringify\(files\)\);\s*LocalDB\.set\(STORE_FILES, 'nova_active_files', files\)\.catch\(console\.error\);/g, '');
code = code.replace(/localStorage\.setItem\('nova_files', JSON\.stringify\(savedFiles\)\);\s*LocalDB\.set\(STORE_FILES, 'nova_active_files', savedFiles\)\.catch\(console\.error\);/g, '');
code = code.replace(/localStorage\.removeItem\('nova_files'\);\s*await LocalDB\.remove\(STORE_FILES, 'nova_active_files'\);/g, '');
code = code.replace(/await LocalDB\.remove\(STORE_FILES, 'nova_active_files'\);\s*localStorage\.removeItem\('nova_files'\);/g, '');

// Also from clearFiles logic
code = code.replace(/await LocalDB\.remove\(STORE_FILES, 'nova_active_files'\);\s*localStorage\.removeItem\('nova_files'\);/g, '');

// Also from initStorage in useEffect
code = code.replace(/let loadedFiles = null;\s*try \{\s*loadedFiles = await LocalDB\.get<Record<string, string>>\(STORE_FILES, 'nova_active_files'\);\s*\} catch \(err\) \{\s*console\.error\("LocalDB Error:", err\);\s*\}\s*const savedMode = localStorage\.getItem\('nova_appMode'\);\s*const savedFilesStr = localStorage\.getItem\('nova_files'\);\s*if \(savedMode\) setAppMode\(savedMode\);\s*if \(loadedFiles\) \{\s*setFiles\(loadedFiles\);\s*\} else if \(savedFilesStr\) \{\s*try \{ \s*const f = JSON\.parse\(savedFilesStr\); \s*setFiles\(f\); \s*await LocalDB\.set\(STORE_FILES, 'nova_active_files', f\);\s*\} catch \(e\) \{\}\s*\}/s, `const savedMode = localStorage.getItem('nova_appMode');
      if (savedMode) setAppMode(savedMode);`);

// And the useEffect watching isHydrated
code = code.replace(/useEffect\(\(\) => \{\s*if \(isHydrated\) \{\s*localStorage\.setItem\('nova_appMode', appMode\);\s*\}\s*\}, \[appMode, files, isHydrated\]\);/s, `useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('nova_appMode', appMode);
    }
  }, [appMode, isHydrated]);`);

// Also update clear workspace to not fail on IDB
code = code.replace(/const handleClearFiles = async \(\) => \{[\s\S]*?\}\s*;/s, `const handleClearFiles = async () => {
    if (!window.confirm("Are you sure you want to clear the active workspace?")) return;
    setFiles({ "/App.js": "" });
    setActiveFile("/App.js");
    setClearChatTrigger(prev => prev + 1);
    setLogs(prev => [...prev, \`[SYSTEM] Workspace cleared. Clean slate ready for \${appMode}.\`]);
    ProjectMemory.clearMemory();
  };`);


fs.writeFileSync('src/components/BuilderLayout.tsx', code);
console.log("Replaced BuilderLayout.tsx logic successfully.");

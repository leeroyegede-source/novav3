const fs = require('fs');

let code = fs.readFileSync('src/components/BuilderLayout.tsx', 'utf8');

// Add import
if (!code.includes("import { supabase }")) {
  code = code.replace(/import \{ LocalDB, STORE_FILES \} from '@\/lib\/storage\/indexedDB';/, "import { LocalDB, STORE_FILES } from '@/lib/storage/indexedDB';\nimport { supabase } from '@/lib/supabaseClient';");
}

// 1. Replace handleSave
code = code.replace(/const handleSave = \(targetFiles = files, targetName\?: string, targetMode\?: string\) => \{[\s\S]*?alert\('Project saved successfully!'\);\s*\}\s*catch\s*\(err\)\s*\{\s*setLogs\(prev => \[\.\.\.prev, '\[ERROR\] Failed to save project metadata\.'\]\);\s*\}\s*\};/s, `const handleSave = async (targetFiles = files, targetName?: string, targetMode?: string) => {
    const mem = ProjectMemory.getMemory();
    const projectId = mem.project_id;
    const projectName = targetName || (mem as any).project_name || 'Untitled Project';
    const finalMode = targetMode || mem.project_mode || appMode;

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) {
      alert("You must be logged in to save projects to the cloud.");
      return;
    }

    setLogs(prev => [...prev, '[SYSTEM] Saving to Supabase cloud...']);

    try {
      const { error: projError } = await supabase.from('projects').upsert({
        id: projectId,
        user_id: user.id,
        name: projectName,
        app_mode: finalMode,
        source: 'Saved via Builder',
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

      VersionManager.saveSnapshot(targetFiles, 'Manual Save');

      const recent = JSON.parse(localStorage.getItem('nova_recent_projects') || '[]');
      const existingIdx = recent.findIndex((p: any) => p.id === projectId);
      const newProject = {
        id: projectId,
        name: projectName,
        mode: finalMode,
        time: Date.now(),
        source: 'Supabase Cloud'
      };
      if (existingIdx >= 0) recent[existingIdx] = newProject;
      else recent.unshift(newProject);
      localStorage.setItem('nova_recent_projects', JSON.stringify(recent));
      
      localStorage.setItem('nova_appMode', finalMode);
      
      window.dispatchEvent(new CustomEvent('nova-recent-updated'));
      setLogs(prev => [...prev, '[SYSTEM] Project saved successfully to Supabase!']);
      if (!targetName) alert('Project saved successfully to Cloud!');
    } catch (err: any) {
      console.error(err);
      setLogs(prev => [...prev, \`[ERROR] Supabase Save Failed: \${err.message}\`]);
      alert(\`Supabase Save Failed: \${err.message}\`);
    }
  };`);

// 2. Replace loadProject
code = code.replace(/const loadProject = async \(projId: string\) => \{[\s\S]*?alert\("Error loading project\."\);\s*\}\s*\};/s, `const loadProject = async (projId: string) => {
    try {
      setLogs(prev => [...prev, \`[SYSTEM] Loading project \${projId} from Supabase...\`]);
      
      const { data: filesData, error } = await supabase
        .from('project_files')
        .select('file_path, content')
        .eq('project_id', projId);

      if (error) throw error;
      
      if (filesData && filesData.length > 0) {
        const savedFiles: Record<string, string> = {};
        filesData.forEach(f => {
          savedFiles[f.file_path] = f.content;
        });
        
        setFiles(savedFiles);
        
        const recentStr = localStorage.getItem('nova_recent_projects');
        if (recentStr) {
          const recent = JSON.parse(recentStr);
          const meta = recent.find((p: any) => p.id === projId);
          if (meta) {
             setAppMode(meta.mode);
             const mem = ProjectMemory.getMemory();
             mem.project_id = projId;
             (mem as any).project_name = meta.name;
             mem.project_mode = meta.mode;
             ProjectMemory.saveMemory(mem);
          }
        }
        
        await VersionManager.loadProject(projId);
        setShowStartScreen(false);
        setLogs(prev => [...prev, \`[SYSTEM] Project loaded successfully from Supabase.\`]);
      } else {
        alert("Project files not found in Supabase.");
      }
    } catch (e: any) {
      console.error(e);
      alert(\`Error loading project from Supabase: \${e.message}\`);
    }
  };`);

// 3. Replace deleteProject
code = code.replace(/const deleteProject = async \(projId: string\) => \{[\s\S]*?alert\("Error deleting project\."\);\s*\}\s*\};/s, `const deleteProject = async (projId: string) => {
    if (!window.confirm("Are you sure you want to delete this project from the cloud?")) return;
    try {
      const mem = ProjectMemory.getMemory();
      if (mem.project_id === projId) {
        alert("You cannot delete the currently open project. Please start a new project first.");
        return;
      }
      
      const { error } = await supabase.from('projects').delete().eq('id', projId);
      if (error) throw error;
      
      const recent = JSON.parse(localStorage.getItem('nova_recent_projects') || '[]');
      const filtered = recent.filter((p: any) => p.id !== projId);
      localStorage.setItem('nova_recent_projects', JSON.stringify(filtered));
      
      window.dispatchEvent(new CustomEvent('nova-recent-updated'));
      setLogs(prev => [...prev, \`[SYSTEM] Project deleted successfully from Supabase.\`]);
    } catch (e: any) {
      console.error(e);
      alert(\`Error deleting project: \${e.message}\`);
    }
  };`);

// Remove localStorage caching of 'nova_files' and 'nova_active_files'
code = code.replace(/localStorage\.setItem\('nova_files', JSON\.stringify\(files\)\);/g, '');
code = code.replace(/localStorage\.removeItem\('nova_files'\);/g, '');
code = code.replace(/LocalDB\.set\(STORE_FILES, 'nova_active_files', files\)\.catch\(console\.error\);/g, '');
code = code.replace(/await LocalDB\.remove\(STORE_FILES, 'nova_active_files'\);/g, '');
code = code.replace(/LocalDB\.remove\(STORE_FILES, 'nova_active_files'\)\.catch\(console\.error\);/g, '');
code = code.replace(/localStorage\.setItem\('nova_files', JSON\.stringify\(savedFiles\)\);/g, '');
code = code.replace(/await LocalDB\.set\(STORE_FILES, 'nova_active_files', savedFiles\);/g, '');
code = code.replace(/localStorage\.setItem\('nova_files', JSON\.stringify\(targetFiles\)\);/g, '');
code = code.replace(/LocalDB\.set\(STORE_FILES, 'nova_active_files', targetFiles\)\.catch\(console\.error\);/g, '');

// Wait, the initStorage still reads from LocalDB and localStorage?
code = code.replace(/let loadedFiles = null;\s*try \{\s*loadedFiles = await LocalDB\.get<Record<string, string>>\(STORE_FILES, 'nova_active_files'\);\s*\} catch \(err\) \{\s*console\.error\("LocalDB Error:", err\);\s*\}/s, 'let loadedFiles = null;');
code = code.replace(/const savedFilesStr = localStorage\.getItem\('nova_files'\);/g, 'const savedFilesStr = null;');
code = code.replace(/\} else if \(savedFilesStr\) \{[\s\S]*?try \{[\s\S]*?const f = JSON\.parse\(savedFilesStr\);[\s\S]*?setFiles\(f\);[\s\S]*?await LocalDB\.set\(STORE_FILES, 'nova_active_files', f\);[\s\S]*?\} catch \(e\) \{\}[\s\S]*?\}/g, '}');

// Now, remove the empty block if it exists
code = code.replace(/if \(loadedFiles\) \{\s*setFiles\(loadedFiles\);\s*\} else if \(savedFilesStr\) \{\s*\}/g, 'if (loadedFiles) { setFiles(loadedFiles); }');
code = code.replace(/if \(loadedFiles\) \{\s*setFiles\(loadedFiles\);\s*\}/g, '');

fs.writeFileSync('src/components/BuilderLayout.tsx', code);
console.log("Updated BuilderLayout.tsx");

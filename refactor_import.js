const fs = require('fs');

let code = fs.readFileSync('src/components/BuilderLayout.tsx', 'utf8');

// 1. autoDetectAndSetMode
code = code.replace(/const autoDetectAndSetMode = \(newFiles: Record<string, string>\) => \{[\s\S]*?setLogs\(prev => \[\.\.\.prev, "\[SYSTEM\] Auto-detected Static HTML\/VanillaJS environment\."\]\);\s*\}\s*\};/s, `const autoDetectAndSetMode = (newFiles: Record<string, string>) => {
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
    setLogs(prev => [...prev, \`[SYSTEM] Auto-detected \${mode} environment.\`]);
    return mode;
  };`);

// 2. handleZipUpload
code = code.replace(/const handleZipUpload = async \(e: React\.ChangeEvent<HTMLInputElement>\) => \{[\s\S]*?e\.target\.value = '';\s*\};/s, `const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    let defaultName = file.name.replace(/\\.zip$/i, '');
    let projectName = prompt(\`Name this imported project (ZIP):\`, defaultName);
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
      
      setLogs(prev => [...prev, \`[SYSTEM] Successfully imported \${Object.keys(newFiles).length} files from ZIP.\`]);
    } catch (err) {
      setLogs(prev => [...prev, \`[ERROR] Failed to parse ZIP: \${(err as Error).message}\`]);
    }
    e.target.value = '';
  };`);

// 3. handleFolderUpload
code = code.replace(/const handleFolderUpload = async \(e: React\.ChangeEvent<HTMLInputElement>\) => \{[\s\S]*?e\.target\.value = '';\s*\};/s, `const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    
    let defaultName = "Imported Folder";
    if (fileList[0].webkitRelativePath) {
      defaultName = fileList[0].webkitRelativePath.split('/')[0] || defaultName;
    }
    
    let projectName = prompt(\`Name this imported project (Folder):\`, defaultName);
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
      
      setLogs(prev => [...prev, \`[SYSTEM] Successfully imported \${count} files from Folder.\`]);
    } catch (err) {
      setLogs(prev => [...prev, \`[ERROR] Folder import failed: \${(err as Error).message}\`]);
    }
    e.target.value = '';
  };`);

// 4. handleGithubImport
code = code.replace(/const handleGithubImport = async \(\) => \{[\s\S]*?setLogs\(prev => \[\.\.\.prev, \`\[ERROR\] GitHub Import failed: \$\{\(err as Error\)\.message\}\`\]\);\s*\}\s*\};/s, `const handleGithubImport = async () => {
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
    
    let projectName = prompt(\`Name this imported project (GitHub):\`, defaultName);
    if (!projectName) return;
    
    setLogs(prev => [...prev, \`[IMPORT] Fetching repository from GitHub...\`]);
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
      
      setLogs(prev => [...prev, \`[SYSTEM] Successfully imported \${Object.keys(newFiles).length} files from GitHub.\`]);
    } catch (err: unknown) {
      setLogs(prev => [...prev, \`[ERROR] GitHub Import failed: \${(err as Error).message}\`]);
    }
  };`);

fs.writeFileSync('src/components/BuilderLayout.tsx', code);
console.log("Updated BuilderLayout.tsx");

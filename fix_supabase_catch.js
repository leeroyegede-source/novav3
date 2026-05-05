const fs = require('fs');

let code = fs.readFileSync('src/components/BuilderLayout.tsx', 'utf8');

// Fix 1: loadProject project_memory fetch
code = code.replace(/supabase\.from\('project_memory'\)\.select\('memory_summary'\)\.eq\('project_id', projId\)\.single\(\)\.then\(\(\{ data \}\) => \{[\s\S]*?\}\)\.catch\(\(\) => ProjectMemory\.saveMemory\(mem\)\);/s, `supabase.from('project_memory').select('memory_summary').eq('project_id', projId).single().then(({ data, error }) => {
                if (!error && data && data.memory_summary) mem.memory_summary = data.memory_summary;
                ProjectMemory.saveMemory(mem);
             });`);

// Fix 2: deleteProject unknown catch
code = code.replace(/if \(source === 'unknown'\) supabase\.from\('projects'\)\.delete\(\)\.eq\('id', projId\)\.catch\(\(\)=>\{\}\);/g, `if (source === 'unknown') supabase.from('projects').delete().eq('id', projId).then(() => {});`);

fs.writeFileSync('src/components/BuilderLayout.tsx', code);
console.log("Fixed supabase promise chains");

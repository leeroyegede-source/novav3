const fs = require('fs');
let code = fs.readFileSync('src/components/BuilderLayout.tsx', 'utf8');

code = code.replace(/const mem = ProjectMemory\.getMemory\(\);\s*mem\.project_id = projId;\s*\(mem as any\)\.project_name = meta\.name;\s*mem\.project_mode = meta\.mode;\s*ProjectMemory\.saveMemory\(mem\);/s, `const mem = ProjectMemory.getMemory();
             mem.project_id = projId;
             (mem as any).project_name = meta.name;
             mem.project_mode = meta.mode;
             
             // Fetch project memory
             supabase.from('project_memory').select('memory_summary').eq('project_id', projId).single().then(({ data }) => {
                if (data && data.memory_summary) {
                   mem.memory_summary = data.memory_summary;
                }
                ProjectMemory.saveMemory(mem);
             });
`);

fs.writeFileSync('src/components/BuilderLayout.tsx', code);
console.log("Updated loadProject to fetch project_memory");

const fs = require('fs');
let code = fs.readFileSync('src/lib/memory/versionManager.ts', 'utf8');

code = code.replace(/\}\)\.eq\('id', id\)\.catch\(console\.error\);/g, `}).eq('id', id).then(({error}) => { if (error) console.error(error); });`);

fs.writeFileSync('src/lib/memory/versionManager.ts', code);
console.log("Fixed second supabase promise chaining in versionManager.ts");

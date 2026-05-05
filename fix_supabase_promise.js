const fs = require('fs');
let code = fs.readFileSync('src/lib/memory/versionManager.ts', 'utf8');

code = code.replace(/\}\)\.catch\(console\.error\);/g, `}).then(({error}) => { if (error) console.error(error); });`);

fs.writeFileSync('src/lib/memory/versionManager.ts', code);
console.log("Fixed supabase promise chaining in versionManager.ts");

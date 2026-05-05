const fs = require('fs');

let code = fs.readFileSync('src/lib/memory/projectMemory.ts', 'utf8');

code = code.replace(/import { LocalDB, STORE_MEMORY } from '\.\.\/storage\/indexedDB';\n/, '');

code = code.replace(/const idbData = await LocalDB\.get<ProjectMemoryState>\(STORE_MEMORY, this\.STORAGE_KEY\);\s*if \(idbData\) \{\s*this\.state = idbData;\s*\} else \{\s*const lsData = localStorage\.getItem\(this\.STORAGE_KEY\);\s*if \(lsData\) \{\s*this\.state = JSON\.parse\(lsData\);\s*await LocalDB\.set\(STORE_MEMORY, this\.STORAGE_KEY, this\.state\);\s*\}\s*\}/s, `const lsData = localStorage.getItem(this.STORAGE_KEY);
          if (lsData) {
            this.state = JSON.parse(lsData);
          }`);

code = code.replace(/LocalDB\.remove\(STORE_MEMORY, this\.STORAGE_KEY\)\.catch\(console\.error\);/g, '');
code = code.replace(/LocalDB\.set\(STORE_MEMORY, this\.STORAGE_KEY, state\)\.catch\(console\.error\);/g, '');
code = code.replace(/console\.error\("Failed to init ProjectMemory from IDB:", e\);/g, 'console.error("Failed to init ProjectMemory:", e);');

fs.writeFileSync('src/lib/memory/projectMemory.ts', code);
console.log("Updated ProjectMemory.ts");

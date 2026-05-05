export interface ASTNode {
  path: string;
  exports: string[];
  imports: string[];
}

export function generateASTMap(files: Record<string, string>): ASTNode[] {
  const map: ASTNode[] = [];
  
  for (const [path, content] of Object.entries(files)) {
    // Only parse TS/JS related files
    if (!path.endsWith('.ts') && !path.endsWith('.tsx') && !path.endsWith('.js') && !path.endsWith('.jsx')) {
      continue;
    }

    const exports: string[] = [];
    const imports: string[] = [];
    
    // Naive regex to match export function, export const, export default
    const exportMatches = content.matchAll(/export\s+(?:default\s+)?(?:function|const|let|var|class|interface|type)\s+([a-zA-Z0-9_]+)/g);
    for (const match of exportMatches) {
      if (match[1]) exports.push(match[1]);
    }
    
    // Match export { ... }
    const namedExportMatches = content.matchAll(/export\s+\{([^}]+)\}/g);
    for (const match of namedExportMatches) {
      if (match[1]) {
        const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0]).filter(Boolean);
        exports.push(...names);
      }
    }
    
    // Naive regex to match imports
    const importMatches = content.matchAll(/import\s+(?:.+?)\s+from\s+['"](.+?)['"]/g);
    for (const match of importMatches) {
      if (match[1]) imports.push(match[1]);
    }
    
    map.push({ path, exports: Array.from(new Set(exports)), imports: Array.from(new Set(imports)) });
  }
  
  return map;
}

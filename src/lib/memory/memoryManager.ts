import fs from 'fs';
import path from 'path';
import os from 'os';

const BASE_DIR = path.join(os.homedir(), 'Desktop', 'NovaAI_Projects');

export interface ProjectMemory {
  features: string[];
  history: string[];
  lastUpdated: string;
}

export function saveProjectLocal(projectId: string, files: Record<string, string>, memory?: ProjectMemory) {
  const projectDir = path.join(BASE_DIR, projectId);
  
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  // Save regular files
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(projectDir, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content);
  }

  // Save .nova memory files
  const novaDir = path.join(projectDir, '.nova');
  if (!fs.existsSync(novaDir)) fs.mkdirSync(novaDir, { recursive: true });

  if (memory) {
    fs.writeFileSync(path.join(novaDir, 'project-memory.json'), JSON.stringify(memory, null, 2));
    fs.writeFileSync(path.join(novaDir, 'architecture.md'), '# Architecture Mapping\n\n(Auto-generated)');
    fs.writeFileSync(path.join(novaDir, 'feature-map.json'), JSON.stringify({ features: memory.features }, null, 2));
    fs.writeFileSync(path.join(novaDir, 'api-map.json'), JSON.stringify({}, null, 2));
    fs.writeFileSync(path.join(novaDir, 'database-map.json'), JSON.stringify({}, null, 2));
    fs.writeFileSync(path.join(novaDir, 'todo.md'), '# Action Items\n\n- Initialize Project');
  }
}

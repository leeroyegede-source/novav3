import { ProjectMemory } from './projectMemory';

export class ProjectScanner {
  static scan(files: Record<string, string>, appMode: string) {
    const memory = ProjectMemory.getMemory();
    memory.project_mode = appMode;
    
    let isNextJs = false;
    let isReactVite = false;
    let isExpress = false;
    let isLaravel = false;
    let isPHP = false;

    // Detect Framework
    if (files['/next.config.js'] || files['/next.config.mjs'] || files['/app/layout.tsx']) isNextJs = true;
    else if (files['/vite.config.ts'] || files['/vite.config.js']) isReactVite = true;
    else if (files['/artisan']) isLaravel = true;
    else if (files['/composer.json'] && !isLaravel) isPHP = true;
    else if (files['/package.json'] && JSON.stringify(files['/package.json']).includes('express')) isExpress = true;

    if (isNextJs) memory.framework = 'Next.js App Router';
    else if (isReactVite) memory.framework = 'React/Vite';
    else if (isLaravel) memory.framework = 'Laravel';
    else if (isPHP) memory.framework = 'PHP Native';
    else if (isExpress) memory.framework = 'Node/Express';
    else memory.framework = 'Vanilla / Unknown';

    // Reset auto-detected items to avoid duplicates
    memory.items = memory.items.filter(i => !['route', 'component', 'api', 'env'].includes(i.type));

    // Scan Routes & Components & Env
    Object.entries(files).forEach(([path, content]) => {
      // Env usage
      if (path.endsWith('.env') || path.endsWith('.env.example') || path.endsWith('.env.local')) {
        const envKeys = content.split('\n').map(l => l.split('=')[0]).filter(k => k && !k.startsWith('#'));
        if (envKeys.length > 0) {
          memory.items.push({
            id: Math.random().toString(36).substring(7),
            type: 'env',
            title: 'Environment Variables',
            content: `Variables required: ${envKeys.join(', ')}`,
            source_file: path,
            importance: 'high',
            created_at: Date.now()
          });
        }
      }

      // Next.js specifics
      if (isNextJs) {
        if (path.includes('/app/api/') && path.endsWith('route.ts')) {
          memory.items.push({ id: Math.random().toString(36).substring(7), type: 'api', title: `API Route: ${path}`, content: 'Next.js API Handler', source_file: path, importance: 'medium', created_at: Date.now() });
        } else if (path.includes('/app/') && (path.endsWith('page.tsx') || path.endsWith('layout.tsx'))) {
          memory.items.push({ id: Math.random().toString(36).substring(7), type: 'route', title: `App Route: ${path}`, content: 'Next.js Page/Layout', source_file: path, importance: 'high', created_at: Date.now() });
        } else if (path.includes('/components/')) {
          memory.items.push({ id: Math.random().toString(36).substring(7), type: 'component', title: `Component: ${path.split('/').pop()}`, content: 'React Component', source_file: path, importance: 'medium', created_at: Date.now() });
        }
      }
      // Express specifics
      else if (isExpress) {
        if (path.includes('/routes/') || path.includes('/controllers/')) {
          memory.items.push({ id: Math.random().toString(36).substring(7), type: 'api', title: `Express Route: ${path}`, content: 'Backend API logic', source_file: path, importance: 'high', created_at: Date.now() });
        }
      }
      // React Vite specifics
      else if (isReactVite) {
        if (path.includes('/src/components/')) {
          memory.items.push({ id: Math.random().toString(36).substring(7), type: 'component', title: `Component: ${path.split('/').pop()}`, content: 'React Component', source_file: path, importance: 'medium', created_at: Date.now() });
        }
      }
    });

    ProjectMemory.saveMemory(memory);
  }
}

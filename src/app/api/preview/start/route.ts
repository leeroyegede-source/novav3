import { NextResponse } from 'next/server';
import { LocalRunner, RuntimeType } from '@/lib/container/localRunner';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const { projectId, files, appMode } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const workspaceDir = path.join(process.cwd(), '.nova-workspace', projectId);
    if (!fs.existsSync(workspaceDir)) fs.mkdirSync(workspaceDir, { recursive: true });

    if (files) {
      // Cleanup files on disk that were deleted in the UI
      const getAllFiles = (dirPath: string, arrayOfFiles: string[] = []) => {
        if (!fs.existsSync(dirPath)) return arrayOfFiles;
        const currentFiles = fs.readdirSync(dirPath);
        currentFiles.forEach((file) => {
          // Ignore heavy/system directories
          if (file === 'node_modules' || file === '.next' || file === '.git' || file === 'vendor') return;
          const fullPath = path.join(dirPath, file);
          if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
          } else {
            arrayOfFiles.push(fullPath);
          }
        });
        return arrayOfFiles;
      };

      const diskFiles = getAllFiles(workspaceDir);
      
      // Map incoming files to absolute paths for comparison
      const incomingPaths = new Set(Object.keys(files).map(k => {
        const safePath = k.startsWith('/') ? k.slice(1) : k;
        return path.join(workspaceDir, safePath);
      }));

      diskFiles.forEach(diskFile => {
        if (!incomingPaths.has(diskFile)) {
           try { fs.unlinkSync(diskFile); } catch (e) {}
        }
      });

      // Write updated files
      for (const [filePath, content] of Object.entries(files)) {
        const safePath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
        const fullPath = path.join(workspaceDir, safePath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        // Prevent mounting .env files unless explicitly approved
        if (safePath.includes('.env')) {
            console.warn(`Skipping .env file: ${safePath}`);
            continue;
        }

        // Inject Auto-Heal Spy Script
        let finalContent = content as string;
        if (typeof finalContent === 'string' && (safePath.endsWith('.html') || safePath.endsWith('.php') || safePath.endsWith('_app.js') || safePath.endsWith('_document.js'))) {
            const spyScript = `
<script>
  window.onerror = function(message, source, lineno, colno, error) {
    window.parent.postMessage({ type: 'BROWSER_ERROR', payload: \`\${message} at \${source}:\${lineno}\` }, '*');
  };
  window.addEventListener('unhandledrejection', function(event) {
    window.parent.postMessage({ type: 'BROWSER_ERROR', payload: event.reason ? event.reason.stack || event.reason.message || event.reason : 'Unhandled Promise Rejection' }, '*');
  });

  // Nova Click-to-Edit Overlay
  let outlineElement = document.createElement('div');
  outlineElement.style.cssText = 'position: absolute; border: 2px solid #6366f1; background: rgba(99,102,241,0.2); pointer-events: none; z-index: 999999; display: none; transition: all 0.1s; border-radius: 4px; box-shadow: 0 0 10px rgba(99,102,241,0.5);';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(outlineElement));

  window.addEventListener('mousemove', function(e) {
    if (e.altKey) {
      const target = e.target;
      if (target && target !== outlineElement && target !== document.body && target !== document.documentElement) {
        const rect = target.getBoundingClientRect();
        outlineElement.style.width = rect.width + 'px';
        outlineElement.style.height = rect.height + 'px';
        outlineElement.style.top = (rect.top + window.scrollY) + 'px';
        outlineElement.style.left = (rect.left + window.scrollX) + 'px';
        outlineElement.style.display = 'block';
        document.body.style.cursor = 'crosshair';
      }
    } else {
      outlineElement.style.display = 'none';
      document.body.style.cursor = '';
    }
  });

  window.addEventListener('keydown', function(e) {
    if (e.key === 'Alt') document.body.style.cursor = 'crosshair';
  });
  window.addEventListener('keyup', function(e) {
    if (e.key === 'Alt') {
      outlineElement.style.display = 'none';
      document.body.style.cursor = '';
    }
  });

  window.addEventListener('click', function(e) {
    if (e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      const target = e.target;
      if (target && target !== outlineElement && target !== document.body && target !== document.documentElement) {
        const elementData = {
          tag: target.tagName.toLowerCase(),
          id: target.id,
          className: target.className,
          text: target.innerText ? target.innerText.slice(0, 50).trim() : ''
        };
        window.parent.postMessage({ type: 'NOVA_ELEMENT_CLICK', payload: elementData }, '*');
      }
    }
  }, true);
</script>
`;
            if ((safePath.endsWith('.html') || safePath.endsWith('.php')) && /<head[^>]*>/i.test(finalContent)) {
                finalContent = finalContent.replace(/(<head[^>]*>)/i, `$1` + spyScript);
            } else if ((safePath.endsWith('_app.js') || safePath.endsWith('_document.js')) && finalContent.includes('return')) {
                // Next.js injection is trickier without breaking React tree, so we skip it for now or do it via next.config.js later
                // Just fallback to Vite for now
            }
        }

        if (typeof finalContent === 'string' && finalContent.startsWith('__NOVA_BASE64__')) {
            const base64Data = finalContent.replace('__NOVA_BASE64__', '');
            fs.writeFileSync(fullPath, Buffer.from(base64Data, 'base64'));
        } else {
            fs.writeFileSync(fullPath, finalContent, 'utf-8');
        }
      }

      // Git-Backed Checkpointing
      try {
        if (!fs.existsSync(path.join(workspaceDir, '.git'))) {
          execSync('git init', { cwd: workspaceDir });
          // Configure dummy user for automated commits just in case global config is missing
          execSync('git config user.name "NovaAI Autonomous Agent"', { cwd: workspaceDir });
          execSync('git config user.email "agent@novaai.dev"', { cwd: workspaceDir });
        }
        execSync('git add .', { cwd: workspaceDir });
        try {
          execSync('git commit -m "NovaAI Autonomous Sync: ' + new Date().toISOString() + '"', { cwd: workspaceDir });
        } catch (commitErr) {
          // git commit exits with code 1 if there are no changes, which is perfectly fine
        }
      } catch (gitErr) {
        console.warn("Git checkpointing skipped: Git may not be installed on host.", gitErr);
      }
    }

    let runtime: RuntimeType = 'static';
    const hasFile = (name: string) => files && Object.keys(files).some(f => f.endsWith(name));
    
    if (appMode === 'Next.js' || hasFile('next.config.js') || hasFile('next.config.mjs')) runtime = 'nextjs';
    else if (appMode === 'Laravel' || hasFile('artisan')) runtime = 'laravel';
    else if (appMode === 'PHP' || hasFile('composer.json') || hasFile('index.php')) runtime = 'php';
    else if (appMode === 'Node / Express' || appMode === 'Node.js' || appMode === 'API Only') runtime = 'node';
    else if (appMode === 'React / Vite' || appMode === 'Vite' || hasFile('vite.config.js') || hasFile('vite.config.ts')) runtime = 'vite';
    else if (files && (files['/package.json'] || files['package.json'])) {
      const pkg = files['/package.json'] || files['package.json'];
      if (typeof pkg === 'string' && pkg.includes('"express"')) runtime = 'node';
      else if (typeof pkg === 'string' && pkg.includes('"next"')) runtime = 'nextjs';
      else runtime = 'vite';
    }

    const result = await LocalRunner.startContainer({
      projectId,
      projectPath: workspaceDir,
      runtime
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

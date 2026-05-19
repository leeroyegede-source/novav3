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

      // Cleanup empty directories left behind
      const removeEmptyDirectories = (dirPath: string) => {
        if (!fs.existsSync(dirPath)) return;
        let currentFiles = fs.readdirSync(dirPath);
        currentFiles.forEach((file) => {
          if (file === 'node_modules' || file === '.next' || file === '.git' || file === 'vendor') return;
          const fullPath = path.join(dirPath, file);
          if (fs.statSync(fullPath).isDirectory()) {
            removeEmptyDirectories(fullPath);
          }
        });
        
        // Only delete if it's actually empty and not the root workspace
        if (dirPath !== workspaceDir) {
           currentFiles = fs.readdirSync(dirPath);
           if (currentFiles.length === 0) {
             try { fs.rmdirSync(dirPath); } catch (e) {}
           }
        }
      };
      removeEmptyDirectories(workspaceDir);

      // Write updated files
      for (const [filePath, content] of Object.entries(files)) {
        const safePath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
        const fullPath = path.join(workspaceDir, safePath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        


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
  let outlineElement = null;

  window.addEventListener('mousemove', function(e) {
    if (e.altKey) {
      if (!outlineElement || !document.body.contains(outlineElement)) {
        outlineElement = document.createElement('div');
        outlineElement.style.cssText = 'position: absolute; border: 2px solid #6366f1; background: rgba(99,102,241,0.2); pointer-events: none; z-index: 999999; display: none; transition: all 0.1s; border-radius: 4px; box-shadow: 0 0 10px rgba(99,102,241,0.5);';
        document.body.appendChild(outlineElement);
      }
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
    } else if (outlineElement) {
      outlineElement.style.display = 'none';
      document.body.style.cursor = '';
    }
  });

  window.addEventListener('keydown', function(e) {
    if (e.key === 'Alt') document.body.style.cursor = 'crosshair';
  });
  window.addEventListener('keyup', function(e) {
    if (e.key === 'Alt') {
      if (outlineElement) outlineElement.style.display = 'none';
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
            // For Next.js/React, inline dangerouslySetInnerHTML scripts can be highly volatile due to hydration and JSX parsing.
            // A foolproof method is to write the spy script to the public directory and reference it.
            const rawJs = spyScript.replace('<script>', '').replace('</script>', '').trim();
            const publicScriptPath = path.join(workspaceDir, 'public', '__nova_spy.js');
            const rootScriptPath = path.join(workspaceDir, '__nova_spy.js');
            const publicDir = path.dirname(publicScriptPath);
            if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
            fs.writeFileSync(publicScriptPath, rawJs);
            fs.writeFileSync(rootScriptPath, rawJs);

            if ((safePath.endsWith('.html') || safePath.endsWith('.php')) && /<\/body>/i.test(finalContent)) {
                finalContent = finalContent.replace(/(<\/body>)/i, `\n<script src="/__nova_spy.js" defer></script>\n$1`);
            } else if ((safePath.endsWith('layout.tsx') || safePath.endsWith('layout.jsx') || safePath.endsWith('layout.js')) && /<\/body>/i.test(finalContent)) {
                // Next.js App Router Support
                const reactScript = `\n        <script src="/__nova_spy.js" defer></script>\n`;
                finalContent = finalContent.replace(/(<\/body>)/i, reactScript + `$1`);
            } else if ((safePath.endsWith('_document.js') || safePath.endsWith('_document.tsx')) && /<\/body>/i.test(finalContent)) {
                // Next.js Pages Router Support
                const reactScript = `\n        <script src="/__nova_spy.js" defer></script>\n`;
                finalContent = finalContent.replace(/(<\/body>)/i, reactScript + `$1`);
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
    
    // Auto-Heal: Next.js runner crashes if next.config.ts is present. Forcibly rename it to .js.
    if (runtime === 'nextjs') {
      const nextConfigTsPath = path.join(workspaceDir, 'next.config.ts');
      const nextConfigJsPath = path.join(workspaceDir, 'next.config.js');
      if (fs.existsSync(nextConfigTsPath)) {
        console.log("Auto-healing: Renaming next.config.ts to next.config.js to prevent runner crash");
        const content = fs.readFileSync(nextConfigTsPath, 'utf8');
        fs.writeFileSync(nextConfigJsPath, content.replace(/import type/g, '// import type').replace(/: NextConfig/g, ''));
        fs.unlinkSync(nextConfigTsPath);
        
        // Also wipe .next cache so it doesn't remember the TS config
        const nextCachePath = path.join(workspaceDir, '.next');
        if (fs.existsSync(nextCachePath)) {
          fs.rmSync(nextCachePath, { recursive: true, force: true });
        }
      }
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

import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function POST(req: Request) {
  try {
    const { files, appMode } = await req.json();

    console.log(`[Container Manager] Booting container for mode: ${appMode}`);

    const e2bKey = process.env.E2B_API_KEY;

    if (!e2bKey) {
      // Graceful fallback for missing E2B Key
      console.warn("[Container Manager] Missing E2B_API_KEY. Using mock localhost tunnel.");
      return NextResponse.json({
        success: true,
        sandboxUrl: "http://localhost:3000/mock-container",
        logs: ["E2B_API_KEY not configured. Falling back to local mock...", "Container simulated on port 8080"]
      });
    }

    const workspaceDir = path.join(process.cwd(), '.nova-workspace');
    if (!fs.existsSync(workspaceDir)) fs.mkdirSync(workspaceDir, { recursive: true });
    
    // Auto-heal next.config.ts permanently
    const globalNextTs = path.join(workspaceDir, 'next.config.ts');
    if (fs.existsSync(globalNextTs)) {
      const content = fs.readFileSync(globalNextTs, 'utf8');
      fs.writeFileSync(path.join(workspaceDir, 'next.config.js'), content.replace(/import type/g, '// import type').replace(/: NextConfig/g, ''));
      fs.unlinkSync(globalNextTs);
      const nextCache = path.join(workspaceDir, '.next');
      if (fs.existsSync(nextCache)) fs.rmSync(nextCache, { recursive: true, force: true });
    }

    // Sync files to disk
    if (files) {
      for (let [filePath, content] of Object.entries(files)) {
        // Auto-heal next.config.ts to prevent Next.js runner crashes
        if (filePath.endsWith('next.config.ts')) {
          const oldPath = path.join(workspaceDir, filePath.startsWith('/') ? filePath.slice(1) : filePath);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          
          filePath = filePath.replace('next.config.ts', 'next.config.js');
          if (typeof content === 'string') {
            content = content.replace(/import type/g, '// import type').replace(/: NextConfig/g, '');
          }
        }
        
        const safePath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
        const fullPath = path.join(workspaceDir, safePath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, content as string, 'utf-8');
      }
    }

    // Return the local proxy port 3001
    return NextResponse.json({
      success: true,
      sandboxUrl: "http://localhost:3001",
      logs: ["Synced files to local .nova-workspace", "Waiting for terminal to start the server on port 3001..."]
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

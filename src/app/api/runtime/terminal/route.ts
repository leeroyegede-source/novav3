import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    const { command, files } = await req.json();
    
    // We create a hidden workspace folder in the project root to act as our local container
    // Use the same projectId as PreviewPanel
    const projectId = "nova-project-1";
    const workspaceDir = path.join(process.cwd(), '.nova-workspace', projectId);
    
    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true });
    }
    
    // Auto-heal next.config.ts permanently
    const globalNextTs = path.join(workspaceDir, 'next.config.ts');
    if (fs.existsSync(globalNextTs)) {
      const content = fs.readFileSync(globalNextTs, 'utf8');
      fs.writeFileSync(path.join(workspaceDir, 'next.config.js'), content.replace(/import type/g, '// import type').replace(/: NextConfig/g, ''));
      fs.unlinkSync(globalNextTs);
      const nextCache = path.join(workspaceDir, '.next');
      if (fs.existsSync(nextCache)) fs.rmSync(nextCache, { recursive: true, force: true });
    }

    // Sync files to the workspace before running the command
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
        
        // Remove leading slash for safe pathing
        const safePath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
        const fullPath = path.join(workspaceDir, safePath);
        
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(fullPath, content as string, 'utf-8');
      }
    }

    console.log(`[Terminal] Executing: ${command} in ${workspaceDir}`);
    
    // Execute the command locally
    const { stdout, stderr } = await execAsync(command, { cwd: workspaceDir });
    
    return NextResponse.json({
      success: true,
      output: stdout || stderr || "Command executed successfully (no output).",
      isError: !!stderr && !stdout
    });

  } catch (error: unknown) {
    console.error("[Terminal Error]", error);
    const err = error as Record<string, unknown>;
    return NextResponse.json({ 
      success: false, 
      output: (err.message as string) || (err.stderr as string) || "Unknown terminal error",
      isError: true
    });
  }
}

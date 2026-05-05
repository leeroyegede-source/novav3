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

    // Sync files to the workspace before running the command
    if (files) {
      for (const [filePath, content] of Object.entries(files)) {
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

import { NextResponse } from 'next/server';
import { LocalRunner, RuntimeType } from '@/lib/container/localRunner';
import path from 'path';

export async function POST(req: Request) {
  try {
    const { projectId, runtime } = await req.json();
    if (!projectId || !runtime) return NextResponse.json({ error: 'Missing projectId or runtime' }, { status: 400 });
    
    const workspaceDir = path.join(process.cwd(), '.nova-workspace', projectId);
    
    const result = await LocalRunner.restartContainer({
      projectId,
      projectPath: workspaceDir,
      runtime: runtime as RuntimeType
    });
    
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

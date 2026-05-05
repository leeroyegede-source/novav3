import { NextResponse } from 'next/server';
import { saveProjectLocal, ProjectMemory } from '@/lib/memory/memoryManager';

export async function POST(req: Request) {
  try {
    const { projectId, files, memory } = await req.json();
    
    if (!projectId || !files) {
      return NextResponse.json({ error: "projectId and files are required" }, { status: 400 });
    }

    saveProjectLocal(projectId, files, memory as ProjectMemory);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

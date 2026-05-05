import { NextResponse } from 'next/server';
import { LocalRunner } from '@/lib/container/localRunner';

export async function POST(req: Request) {
  try {
    const { projectId } = await req.json();
    if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    await LocalRunner.stopContainer(projectId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { LocalRunner } from '@/lib/container/localRunner';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
  
  const status = LocalRunner.getStatus(projectId);
  return NextResponse.json(status);
}

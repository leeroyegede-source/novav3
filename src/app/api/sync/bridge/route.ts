import { NextResponse } from 'next/server';

// In-memory bridge for real-time local sync
// In a production environment, this would use Redis or Supabase Realtime
const syncState: Record<string, { files: Record<string, string>, timestamp: number }> = {};

export async function POST(req: Request) {
  try {
    const { projectId, files } = await req.json();
    if (!projectId || !files) return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    
    syncState[projectId] = { files, timestamp: Date.now() };
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
  
  const state = syncState[projectId];
  if (!state) return NextResponse.json({ files: null });
  
  return NextResponse.json({ files: state.files, timestamp: state.timestamp });
}

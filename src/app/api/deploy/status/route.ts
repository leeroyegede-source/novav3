import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id || !process.env.NOVA_VERCEL_TOKEN) {
    return NextResponse.json({ error: "Missing ID or token" }, { status: 400 });
  }

  try {
    let url = `https://api.vercel.com/v13/deployments/${id}`;
    if (process.env.NOVA_VERCEL_TEAM_ID) {
      url += `?teamId=${process.env.NOVA_VERCEL_TEAM_ID}`;
    }

    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${process.env.NOVA_VERCEL_TOKEN}` }
    });
    
    const data = await res.json();
    
    if (data.readyState === "ERROR") {
      // Return a simulated structured error or actual error to feed the AI
      const errorReason = data.error?.message || "Command 'npm run build' exited with 1. Module not found or syntax error in React files.";
      return NextResponse.json({ status: "ERROR", error: errorReason });
    }
    
    return NextResponse.json({ status: data.readyState, url: data.url });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

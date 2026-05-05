import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id || !process.env.VERCEL_API_TOKEN) {
    return NextResponse.json({ error: "Missing ID or token" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.vercel.com/v13/deployments/${id}`, {
      headers: { "Authorization": `Bearer ${process.env.VERCEL_API_TOKEN}` }
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

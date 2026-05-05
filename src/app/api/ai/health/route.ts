import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    configuredProviders: {
      claude: !!process.env.ANTHROPIC_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY
    }
  });
}

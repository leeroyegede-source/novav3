import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, history, aiModel, apiKey } = body;

    let kbContent = '';
    try {
      const kbPath = path.join(process.cwd(), 'nova_knowledge_base.md');
      kbContent = fs.readFileSync(kbPath, 'utf8');
    } catch (e) {
      kbContent = 'No knowledge base found. Advise user that manual is missing.';
    }

    const systemPrompt = `You are the Nova Guide, a highly intelligent advisory assistant equipped with vast global knowledge.
Your PRIMARY source of truth for platform-specific questions is the following Knowledge Base manual:

=== KNOWLEDGE BASE ===
${kbContent}
======================

RULES & CONSTRAINTS:
1. PLATFORM AWARENESS: Use the Knowledge Base above to perfectly answer any questions about using NovaAI.
2. VAST KNOWLEDGE: You are explicitly authorized to draw upon your vast global training data to answer ANY other user question (science, history, general advice, etc.).
3. CRITICAL NON-CODING RULE: You are an advisory assistant, NOT a coding agent. You may explain concepts conceptually, but you must NEVER generate application code, project files, or JSON file operations.
4. Keep answers concise, friendly, and beautifully formatted in markdown.`;

    const mappedHistory = (history || []).map((m: any) => ({
      role: m.role === 'agent' ? 'assistant' : 'user',
      content: m.content
    }));

    const activeGeminiKey = process.env.GEMINI_API_KEY;
    if (!activeGeminiKey) {
      return NextResponse.json({ reply: "I'm sorry, no Gemini API key is configured in your .env file!" });
    }

    // You requested "gemini-3.1-flash-lite" as the model endpoint.
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${activeGeminiKey}`;
    
    const contents = [...mappedHistory, { role: 'user', content: prompt }].map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents
      })
    });

    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Error parsing Gemini response.';

    return NextResponse.json({ reply });
  } catch (error: unknown) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

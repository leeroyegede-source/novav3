import { NextResponse } from 'next/server';
import { routeToAgent, determineRoute } from '@/lib/agents/orchestrator';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = body.prompt || "";
    const currentFiles = body.currentFiles || {};
    const imageBase64 = body.imageBase64;
    const history = body.history || [];
    const appMode = body.appMode || "Auto Detect";
    const memory = body.memory || {};
    const isAutoHeal = body.isAutoHeal || false;

    // Structured Routing Step
    const routingInfo = await determineRoute(prompt, isAutoHeal);

    // Stream progress headers or just do standard return for now (will implement pseudo-streaming)
    const response = await routeToAgent({
      role: routingInfo.selectedRole as any,
      routingInfo,
      prompt,
      context: {
        files: currentFiles,
        memory: memory,
        logs: [],
        imageBase64,
        history,
        appMode
      }
    });
    
    let generatedFiles = { ...currentFiles };
    
    if (response.fileOperations?.create) {
      generatedFiles = { ...generatedFiles, ...response.fileOperations.create };
    }
    if (response.fileOperations?.update) {
      generatedFiles = { ...generatedFiles, ...response.fileOperations.update };
    }
    if (response.fileOperations?.delete) {
      response.fileOperations.delete.forEach(f => delete generatedFiles[f]);
    }

    return NextResponse.json({
      success: true,
      files: generatedFiles,
      message: response.message,
      reasoning: response.reasoning,
      structuredResponse: response.structuredResponse,
      routing: routingInfo
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

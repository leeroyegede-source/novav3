import { NextResponse } from 'next/server';
import { routeToAgent, determineRoute } from '@/lib/agents/orchestrator';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = body.prompt || "";
    // 1. HARD BLOCK: Strip massive generated directories
    const safeFiles: Record<string, string> = {};
    const ignoredPatterns = ['node_modules/', '.next/', '.git/', 'dist/', 'build/', 'FULL_CODE_DUMP.txt'];
    for (const [path, content] of Object.entries(body.currentFiles || {})) {
      if (!ignoredPatterns.some(p => path.includes(p))) {
        safeFiles[path] = content as string;
      }
    }

    // 2. CONTEXT LIMITER: Strict character budget (approx 60k tokens)
    const MAX_BUDGET = 200000;
    let currentBudget = 0;
    const finalFiles: Record<string, string> = {};
    const omittedFiles: string[] = [];

    // Prioritize active file and configs
    const prioritize = (path: string) => path.includes('package.json') || path.includes('config') || path === body.activeFile;
    
    // Sort keys to process priority files first
    const sortedPaths = Object.keys(safeFiles).sort((a, b) => {
      if (prioritize(a) && !prioritize(b)) return -1;
      if (!prioritize(a) && prioritize(b)) return 1;
      return 0;
    });

    for (const path of sortedPaths) {
      const content = safeFiles[path];
      if (currentBudget + content.length <= MAX_BUDGET) {
        finalFiles[path] = content;
        currentBudget += content.length;
      } else {
        omittedFiles.push(path);
      }
    }

    // 3. SLIDING HISTORY WINDOW: Only send last 4 messages
    const history = (body.history || []).slice(-4);
    const imageBase64 = body.imageBase64;
    
    const appMode = body.appMode || "Auto Detect";
    const memory = body.memory || {};
    const isAutoHeal = body.isAutoHeal || false;
    const aiModel = body.aiModel || "default";
    const apiKey = body.apiKey || "";

    // Structured Routing Step
    const routingInfo = await determineRoute(prompt, isAutoHeal);

    // Stream progress headers or just do standard return for now
    const response = await routeToAgent({
      role: routingInfo.selectedRole as any,
      routingInfo,
      prompt,
      context: {
        files: finalFiles,
        omittedFiles,
        memory: memory,
        logs: [],
        imageBase64,
        history,
        appMode
      },
      aiModel,
      apiKey
    });
    
    let generatedFiles = { ...safeFiles };
    
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

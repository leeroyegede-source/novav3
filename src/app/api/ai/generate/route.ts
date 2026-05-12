import { NextResponse } from 'next/server';
import { routeToAgent, determineRoute } from '@/lib/agents/orchestrator';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.novaSaferEnabled) {
      return await runNovaSaferRequest(body);
    }
    return await runDefaultAIRequest(body);
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function runDefaultAIRequest(body: any) {
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
    response.fileOperations.delete.forEach((f: string) => delete generatedFiles[f]);
  }

  return NextResponse.json({
    success: true,
    files: generatedFiles,
    message: response.message,
    reasoning: response.reasoning,
    structuredResponse: response.structuredResponse,
    routing: routingInfo
  });
}

async function runNovaSaferRequest(body: any) {
  const prompt = body.prompt || "";
  const imageBase64 = body.imageBase64;
  const safeFiles: Record<string, string> = {};
  const ignoredPatterns = ['node_modules/', '.next/', '.git/', 'dist/', 'build/', 'FULL_CODE_DUMP.txt'];
  for (const [path, content] of Object.entries(body.currentFiles || {})) {
    if (!ignoredPatterns.some(p => path.includes(p))) safeFiles[path] = content as string;
  }
  
  const history = (body.history || []).slice(-4);
  const memory = body.memory || {};
  const appMode = body.appMode || "Auto Detect";
  const isAutoHeal = body.isAutoHeal || false;
  
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error("Missing GEMINI_API_KEY for NoVa Safer mode.");
  
  const classificationPrompt = `You are the NoVa Safer Classifier. 
Classify the task into ONE of these types: non_coding, planning, coding, debugging, documentation, explanation.
Task: ${prompt}
App Mode: ${appMode}
Is Auto Heal Request: ${isAutoHeal}

Respond in strict JSON ONLY:
{
  "mode": "NoVa Safer",
  "routerModel": "gemini-2.5-flash",
  "codingModel": "claude-sonnet-4-6",
  "taskType": "type",
  "selectedModel": "model",
  "reason": "reason",
  "requiredFiles": [],
  "excludedFiles": [],
  "tokenPolicy": "minimal_context_only",
  "riskLevel": "low",
  "maxRetries": 2
}

Rules:
1. If the task requires code generation, editing, fixing, debugging -> codingModel is claude-sonnet-4-6, selectedModel is claude-sonnet-4-6.
2. If the task is explanation, summary, planning, documentation, or non_coding -> selectedModel is gemini-2.5-flash.
3. In "requiredFiles", list exactly the files needed for the task from this available list: [${Object.keys(safeFiles).join(", ")}].
`;

  const classifyRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: classificationPrompt }] }],
      generationConfig: { response_mime_type: "application/json" }
    })
  });
  
  if (!classifyRes.ok) throw new Error("NoVa Safer routing via Gemini failed: " + await classifyRes.text());
  const classifyData = await classifyRes.json();
  const rawText = classifyData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  let routingDecision;
  try {
    routingDecision = JSON.parse(rawText);
  } catch (e) {
    routingDecision = { selectedModel: "claude-sonnet-4-6", reason: "Fallback coding model", requiredFiles: Object.keys(safeFiles) };
  }
  
  if (routingDecision.selectedModel === 'gemini-2.5-flash') {
    const answerPrompt = `You are NoVa Safer AI (Gemini Flash). Handle this non-coding task: ${prompt}. Return a helpful, concise response.`;
    const parts: any[] = [{ text: answerPrompt }];
    if (imageBase64) {
      const match = imageBase64.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
      if (match) parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
    }
    const ansRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }]
      })
    });
    const ansData = await ansRes.json();
    const answerText = ansData.candidates?.[0]?.content?.parts?.[0]?.text || "Task complete.";
    
    return NextResponse.json({
      success: true,
      files: safeFiles,
      message: answerText,
      reasoning: routingDecision.reason || "Processed by Gemini Flash.",
      structuredResponse: {
        status: 'Complete',
        mode: appMode,
        editMode: 'None',
        task: prompt,
        plan: routingDecision.reason || "Handled via Flash",
        filesSelected: [],
        filesChanged: [],
        changesMade: "No files changed.",
        runnerCheck: "not run",
        previewCheck: "not run",
        saveCheck: "not saved",
        safetyCheck: { snapshotCreated: false, secretsExposed: false, runnerTouched: false, scaffoldChanged: false, rollbackAvailable: false },
        nextStep: "continue"
      },
      routing: routingDecision
    });
  } else {
    // Coding task via Claude Sonnet 4.6
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) throw new Error("Missing ANTHROPIC_API_KEY for NoVa Safer Coding mode.");
    
    const finalFiles: Record<string, string> = {};
    const requiredSet = new Set(routingDecision.requiredFiles || []);
    for (const f of Object.keys(safeFiles)) {
      if (requiredSet.has(f) || f.includes('package.json') || f.includes('next.config') || f.includes('vite.config')) {
        finalFiles[f] = safeFiles[f];
      }
    }
    
    const systemPrompt = `You are the NoVa Safer Coding Agent (Claude Sonnet 4.6).
Task: ${prompt}
App Mode: ${appMode}
Is Auto Heal Debugging: ${isAutoHeal}

Current required files:
${JSON.stringify(finalFiles, null, 2)}
Project Memory:
${JSON.stringify(memory, null, 2)}

You MUST return a STRICT JSON object representing file modifications. DO NOT wrap it in markdown \`\`\`json.
{
  "message": "A conversational markdown response",
  "reasoning": "Why you made the changes",
  "structuredResponse": {
    "status": "Complete",
    "mode": "${appMode}",
    "editMode": "Surgical Patch",
    "task": "short desc",
    "plan": "Safe build plan",
    "filesSelected": ["files you modified"],
    "filesChanged": ["files you modified"],
    "changesMade": "explanation",
    "runnerCheck": "not run",
    "previewCheck": "not run",
    "saveCheck": "not saved",
    "safetyCheck": { "snapshotCreated": true, "secretsExposed": false, "runnerTouched": false, "scaffoldChanged": false, "rollbackAvailable": true },
    "nextStep": "continue"
  },
  "fileOperations": {
    "create": { "/path/to/newfile.js": "code" },
    "update": { "/path/to/existing.js": "code" },
    "delete": []
  }
}

Safety Rules: 
1. Never delete runner-critical files. Preserve app mode scaffolding.
2. Provide only surgical patches unless full rewrite is requested.
3. If this is an auto-heal, provide one final retry fix based on the prompt.
4. IMPORTANT: Escape all newlines in JSON strings as \\n. NEVER use literal newlines inside JSON values.`;

    const claudeContent: any[] = [{ type: 'text', text: prompt }];
    if (imageBase64) {
      const match = imageBase64.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
      if (match) {
        claudeContent.push({
          type: 'image',
          source: { type: 'base64', media_type: match[1], data: match[2] }
        });
      }
    }

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: claudeContent }]
      })
    });
    
    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      throw new Error("NoVa Safer coding failed: " + errText);
    }
    
    const claudeData = await claudeRes.json();
    const content = claudeData.content?.[0]?.text || "{}";
    
    let jsonStr = content;
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }
    
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error("Failed to parse Claude Sonnet JSON response: " + content.substring(0, 150));
    }
    
    let generatedFiles = { ...safeFiles };
    if (parsed.fileOperations?.create) generatedFiles = { ...generatedFiles, ...parsed.fileOperations.create };
    if (parsed.fileOperations?.update) generatedFiles = { ...generatedFiles, ...parsed.fileOperations.update };
    
    let isContractBroken = false;
    if (parsed.fileOperations?.delete) {
      const safeToDelete = parsed.fileOperations.delete.filter((f: string) => {
        if (f.includes('package.json') || f.includes('vite.config') || f.includes('next.config') || f.includes('index.html') || f.includes('server.js') || f.includes('index.php')) {
          isContractBroken = true;
          return false;
        }
        return true;
      });
      safeToDelete.forEach((f: string) => delete generatedFiles[f]);
    }
    
    if (isContractBroken) {
      parsed.reasoning = (parsed.reasoning || "") + " [WARNING: Attempted to delete critical scaffold files. Blocked by NoVa Safer contract.]";
    }
    
    return NextResponse.json({
      success: true,
      files: generatedFiles,
      message: parsed.message || "Completed coding task with Claude Sonnet 4.6.",
      reasoning: parsed.reasoning || "Executed code via Claude Sonnet.",
      structuredResponse: parsed.structuredResponse,
      routing: routingDecision
    });
  }
}

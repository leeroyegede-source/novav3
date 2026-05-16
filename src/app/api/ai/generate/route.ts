import { NextResponse } from 'next/server';
import { routeToAgent, determineRoute } from '@/lib/agents/orchestrator';

function applyFileUpdates(generatedFiles: Record<string, string>, safeFiles: Record<string, string>, updates: any) {
  for (const [filePath, contentOrPatches] of Object.entries(updates)) {
    if (typeof contentOrPatches === 'string') {
      generatedFiles[filePath] = contentOrPatches;
    } else if (Array.isArray(contentOrPatches)) {
      let fileLines = (generatedFiles[filePath] || safeFiles[filePath] || '').split('\n');
      const sortedPatches = [...contentOrPatches].sort((a, b) => b.startLine - a.startLine);
      for (const patch of sortedPatches) {
        if (patch.action === 'replace') {
          const start = Math.max(0, patch.startLine - 1);
          const end = Math.min(fileLines.length, patch.endLine);
          const newLines = patch.code.split('\n');
          fileLines.splice(start, end - start, ...newLines);
        }
      }
      generatedFiles[filePath] = fileLines.join('\n');
    }
  }
}

function enforceRunnerContracts(operations: any) {
  const critical = ['package.json', 'next.config.js', 'vite.config.js', 'index.html', 'index.php', 'src/main.jsx', 'src/App.jsx', 'server.js', 'index.js'];
  if (operations?.delete) {
    operations.delete = operations.delete.filter((f: string) => !critical.some(c => f.endsWith(c)));
  }
  
  // Hardcode intercept for Next.js scaffolding crash (Runner does not support next.config.ts)
  if (operations?.create) {
    const keys = Object.keys(operations.create);
    for (const k of keys) {
      if (k.endsWith('next.config.ts')) {
        const newKey = k.replace('next.config.ts', 'next.config.js');
        operations.create[newKey] = operations.create[k];
        delete operations.create[k];
      }
    }
  }
  
  if (operations?.update) {
    for (const update of operations.update) {
      if (update.file && update.file.endsWith('next.config.ts')) {
        update.file = update.file.replace('next.config.ts', 'next.config.js');
      }
    }
  }
}

async function generateExecutionPlan(prompt: string, aiModel: string, apiKey: string, sysPrompt: string) {
  let jsonStr = "{}";
  if (aiModel.includes('gemini')) {
    const geminiKey = apiKey || process.env.GEMINI_API_KEY;
    if (geminiKey) {
      const modelId = (aiModel === 'gemini-free' || !aiModel.includes('gemini')) ? 'gemini-2.5-flash' : aiModel;
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: sysPrompt }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { response_mime_type: "application/json" }
        })
      });
      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        jsonStr = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      }
    }
  } else {
    const anthropicKey = apiKey || process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      const planRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: (aiModel === 'claude-sonnet-4-6' || aiModel === 'claude-haiku-4-6') ? 'claude-haiku-4-6' : 'claude-haiku-4-5',
          max_tokens: 1500,
          system: sysPrompt,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (planRes.ok) {
        const planData = await planRes.json();
        jsonStr = planData.content?.[0]?.text || "{}";
      }
    }
  }

  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  }
  const parsedPlan = JSON.parse(jsonStr);
  return parsedPlan.stages || [];
}
export async function POST(req: Request) {
  try {
    const body = await req.json();
    return await runDefaultAIRequest(body);
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function runDefaultAIRequest(body: any) {
  let prompt = body.prompt || "";
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

  let generatedFiles = { ...safeFiles };
    
  // Auto-heal next.config.ts globally for Next.js crashes
  const genFileKeys = Object.keys(generatedFiles);
  for (const key of genFileKeys) {
    if (key.endsWith('next.config.ts')) {
      const newKey = key.replace('next.config.ts', 'next.config.js');
      let content = generatedFiles[key];
      if (typeof content === 'string') {
        content = content.replace(/import type/g, '// import type').replace(/: NextConfig/g, '');
      }
      generatedFiles[newKey] = content;
      delete generatedFiles[key];
    }
  }

  let finalMessage = "";
  let finalReasoning = "";
  let finalStructuredResponse: any = null;

  if (imageBase64) {
    const match = imageBase64.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
    if (match) {
      const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
      const assetPath = `/public/assets/upload_${Date.now()}.${ext}`;
      generatedFiles[assetPath] = `__NOVA_BASE64__${match[2]}`;
      prompt += `\n\n[SYSTEM DIRECTIVE]: I have uploaded an image. I automatically saved it to the project at \`${assetPath}\`. You MUST use this exact local asset path as the image source in your code.`;
    }
  }

  // --- THE PLANNER GATEWAY (Agentic State Machine) ---
  let plan: { stage: number | string, task: string }[] = [];
  let originalPlan: { stage: number | string, task: string }[] = [];

  const isDirectEdit = (prompt.includes('Make changes to the') && prompt.includes('element')) || !!imageBase64;

  if (!isAutoHeal && !isDirectEdit) {
    const pLower = prompt.toLowerCase();
    if ((pLower.includes('continue') || pLower.includes('proceed')) && memory.pending_plan && memory.pending_plan.length > 0) {
      console.log("[Planner Pipeline] Resuming paused execution plan...");
      plan = memory.pending_plan;
      originalPlan = memory.full_plan || plan;
      finalMessage += `### Resuming Execution\nPicking up from Stage ${plan[0].stage}...\n`;
    } else {
      console.log("[Planner Pipeline] Task is Large/Medium. Generating strict execution plan...");
      try {
        const sysPrompt = `You are the NovaAI Planner Agent. Your ONLY job is to break the user's prompt into very small, token-safe coding stages.
App Mode: ${appMode}

Respond in strict JSON ONLY:
{
  "stages": [
    { "stage": 1, "task": "initialize main entry file (e.g. App.js, index.html) and replace boilerplate scaffolding" },
    { "stage": 2, "task": "add routing and navigation" }
  ]
}
STABLE BUILD MODE RULES (CRITICAL):
1. Stage 1 MUST ALWAYS explicitly update or create the main entry file for the application so the preview compiler and runner work immediately. Do not leave the original scaffolding untouched in Stage 1.
2. STUB-FIRST DEVELOPMENT MODE: Stages must follow a strict sequence: Types/Interfaces -> Route Shell -> Placeholder UI -> API Stubs -> Real Logic. Never immediately build full logic.
3. MODULE EXECUTION RULE: Every stage MUST be independently compilable and executable. Do NOT generate a stage that requires a future stage to compile.
4. Maximum 4 files per stage. Make tasks microscopic.
5. AESTHETICS & IMAGES: If the task involves UI, the final stage MUST explicitly be "Apply premium CSS, typography, hover states, and create beautifully styled blank placeholders for all images to ensure a breathtaking final design."`;
        plan = await generateExecutionPlan(prompt, aiModel, apiKey, sysPrompt);

        // --- HARDCODED STAGE 1 INTERCEPTOR ---
        if (plan && plan.length > 0) {
          const entryFileMap: Record<string, string> = {
            "React / Vite": "src/App.jsx",
            "Next.js": "pages/index.js or src/app/page.tsx",
            "Node / Express": "index.js",
            "Static Website": "index.html",
            "PHP": "index.php"
          };
          const targetFiles = entryFileMap[appMode] || "the main entry file (e.g. App.jsx, index.html)";

          const stage1Task = plan[0].task.toLowerCase();
          const hasEntryFile = stage1Task.includes('app.') || stage1Task.includes('index.') || stage1Task.includes('page.') || stage1Task.includes('main.');

          if (!hasEntryFile) {
            console.log(`[Planner Pipeline] Interceptor: Stage 1 missing entry files. Injecting mandatory edit...`);
            plan[0].task = `[MANDATORY EDIT] Update ${targetFiles} to replace the boilerplate scaffolding with the new layout. AND ALSO: ` + plan[0].task;
          }
        }

        originalPlan = [...plan];
      } catch (e) {
        console.error("[Planner Pipeline] Failed to generate plan, falling back to single execution.", e);
      }
    }
  }

  // --- THE EXECUTION LOOP ---
  if (plan.length > 0) {
    console.log(`[Orchestrator] Executing stages autonomously...`);

    while (plan.length > 0) {
      const stage = plan[0];
      console.log(`[Orchestrator] Running Stage ${stage.stage}: ${stage.task}`);

      const stagePrompt = `STAGE ${stage.stage}: ${stage.task}
(Original overall goal: ${prompt})

CRITICAL INSTRUCTION: Execute ONLY the exact task for this stage. Do NOT attempt to complete the rest of the project. Focus strictly on this micro-task.`;

      try {
        const compressedFiles = await compressStageContext(stage.task, generatedFiles, memory, aiModel, apiKey);

        const response = await routeToAgent({
          role: routingInfo.selectedRole as any,
          routingInfo,
          prompt: stagePrompt,
          context: {
            files: compressedFiles,
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

        if (response.message && (response.message.includes('hit the output limit') || response.message.includes('invalid JSON'))) {
          console.warn(`[Self-Healing] Stage ${stage.stage} failed. Splitting dynamically...`);
          const splitSysPrompt = `You are the NovaAI Stage Splitter. The following task was too large to execute. 
Break this EXACT task into 2 or 3 microscopic sub-stages.
Respond in strict JSON ONLY: { "stages": [ {"stage": "${stage.stage}.1", "task": "sub-task 1"}, {"stage": "${stage.stage}.2", "task": "sub-task 2"} ] }`;
          try {
            const subStages = await generateExecutionPlan(stage.task, aiModel, apiKey, splitSysPrompt);
            if (subStages && subStages.length > 0) {
              plan.shift();
              plan.unshift(...subStages);
              finalMessage += `\n\n🔄 **Stage ${stage.stage} Failed & Split**: Automatically breaking it down into smaller sub-stages...`;
              continue;
            }
          } catch (e) {
            console.warn("Failed to split stage.", e);
          }
        }

        enforceRunnerContracts(response.fileOperations);

        if (response.fileOperations?.create) {
          generatedFiles = { ...generatedFiles, ...response.fileOperations.create };
        }
        if (response.fileOperations?.update) {
          applyFileUpdates(generatedFiles, safeFiles, response.fileOperations.update);
        }
        if (response.fileOperations?.delete) {
          response.fileOperations.delete.forEach((f: string) => delete generatedFiles[f]);
        }

        finalMessage += `\n\n✅ **Stage ${stage.stage} Complete**: ${stage.task}\n${response.message}`;
        finalReasoning = response.reasoning;
        finalStructuredResponse = response.structuredResponse || {};

        plan.shift(); // remove completed stage

        // Stop after EVERY stage to ensure safe compilation checkpoints and prevent timeouts
        if (plan.length > 0) {
          const nextStage = plan[0];
          finalMessage += `\n\n⏸️ **Stage Complete. Compilation Checkpoint Reached.**\nReady for Next Stage: ${nextStage.task}\nReply "proceed" or "continue" to execute the next stage.`;
          finalStructuredResponse.pendingPlan = plan;
          finalStructuredResponse.fullPlan = originalPlan;
          break;
        } else {
          finalMessage += `\n\n🎉 **All Stages Complete!**`;
          finalStructuredResponse.pendingPlan = [];
          finalStructuredResponse.fullPlan = originalPlan;
        }

      } catch (err: any) {
        if (err.message.includes('credit') || err.message.includes('429') || err.message.includes('balance') || err.message.includes('Overloaded')) {
          finalMessage += `\n\n⚠️ **Credit / Rate Limit Exhausted**\nStopped at Stage ${stage.stage}. Please add credits or wait, and reply "continue" to resume this exact stage.`;
          if (!finalStructuredResponse) finalStructuredResponse = {};
          finalStructuredResponse.pendingPlan = plan;
          finalStructuredResponse.fullPlan = originalPlan;
          break;
        } else {
          throw err;
        }
      }
    }

  } else {
    // Standard Single Execution (Small Tasks or Auto-Heal)
    let finalPrompt = prompt;

    // --- THE DEDICATED ERROR RECOVERY FLOW ---
    if (isAutoHeal) {
      console.log("[Diagnostics Engine] Analyzing build failure...");
      finalPrompt = await diagnoseBuildError(prompt, finalFiles, aiModel, apiKey);
    }

    const response = await routeToAgent({
      role: routingInfo.selectedRole as any,
      routingInfo,
      prompt: finalPrompt,
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

    enforceRunnerContracts(response.fileOperations);

    if (response.fileOperations?.create) {
      generatedFiles = { ...generatedFiles, ...response.fileOperations.create };
    }
    if (response.fileOperations?.update) {
      applyFileUpdates(generatedFiles, safeFiles, response.fileOperations.update);
    }
    if (response.fileOperations?.delete) {
      response.fileOperations.delete.forEach((f: string) => delete generatedFiles[f]);
    }

    finalMessage = response.message;
    finalReasoning = response.reasoning;
    finalStructuredResponse = response.structuredResponse;
  }

  // --- ASSET MANIFEST ENGINE ---
  const manifestKey = Object.keys(generatedFiles).find(k => k.endsWith('nova-assets.json'));
  if (manifestKey) {
    try {
      const manifestStr = generatedFiles[manifestKey];
      const manifest = JSON.parse(manifestStr);
      for (const [assetPath, config] of Object.entries(manifest)) {
        if (typeof config === 'object' && config !== null) {
          const { prompt: imgPrompt, width = 800, height = 600 } = config as any;
          if (imgPrompt) {
            console.log(`[Asset Engine] Fetching AI image for ${assetPath}...`);
            const encodedPrompt = encodeURIComponent(imgPrompt);
            const imgRes = await fetch(`https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true`);
            if (imgRes.ok) {
              const arrayBuffer = await imgRes.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString('base64');
              const safePath = assetPath.startsWith('/') ? assetPath : '/' + assetPath;
              generatedFiles[safePath] = `__NOVA_BASE64__${base64}`;
            }
          }
        }
      }
    } catch (e) {
      console.error("[Asset Engine] Failed to process nova-assets.json", e);
    }
    delete generatedFiles[manifestKey];
  }

  return NextResponse.json({
    success: true,
    files: generatedFiles,
    message: finalMessage,
    reasoning: finalReasoning,
    structuredResponse: finalStructuredResponse,
    routing: routingInfo
  });
}

// Removed runNovaSaferRequest as requested

async function compressStageContext(task: string, files: Record<string, string>, memory: any, aiModel: string, apiKey: string) {
  const fileKeys = Object.keys(files);
  if (fileKeys.length <= 4) return files; // Too small to need compression

  const prompt = `You are the NoVa Context Compressor. 
Task: ${task}

Available Files:
${fileKeys.join('\n')}

Select ONLY the files strictly required to complete this task. Ignore unnecessary files.
Respond in strict JSON:
{ "required_files": ["path/to/file1", "path/to/file2"] }`;

  let jsonStr = "{}";

  if (aiModel.includes('gemini')) {
    const geminiKey = apiKey || process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const modelId = (aiModel === 'gemini-free' || !aiModel.includes('gemini')) ? 'gemini-2.5-flash' : aiModel;
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { response_mime_type: "application/json" }
          })
        });
        if (res.ok) {
          const data = await res.json();
          jsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        }
      } catch (e) { }
    }
  } else {
    const anthropicKey = apiKey || process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({
            model: (aiModel === 'claude-sonnet-4-6' || aiModel === 'claude-haiku-4-6') ? 'claude-haiku-4-6' : 'claude-haiku-4-5',
            max_tokens: 1500,
            system: "You are the NoVa Context Compressor.",
            messages: [{ role: 'user', content: prompt }]
          })
        });
        if (res.ok) {
          const data = await res.json();
          jsonStr = data.content?.[0]?.text || "{}";
        }
      } catch (e) { }
    }
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.required_files && Array.isArray(parsed.required_files)) {
      const compressedFiles: Record<string, string> = {};
      for (const f of parsed.required_files) {
        if (files[f]) compressedFiles[f] = files[f];
      }
      // RUNNER CONTRACTS ALWAYS RETAINED
      const contracts = ['package.json', 'next.config.js', 'vite.config.js', 'index.html', 'index.php', 'src/main.jsx', 'src/App.jsx', 'server.js', 'index.js'];
      for (const contract of contracts) {
        const matchedKey = Object.keys(files).find(k => k.includes(contract));
        if (matchedKey) compressedFiles[matchedKey] = files[matchedKey];
      }
      if (Object.keys(compressedFiles).length > 0) return compressedFiles;
    }
  } catch (e) {
    console.warn("[Context Compressor] Failed, falling back to full context.", e);
  }
  return files;
}

async function diagnoseBuildError(errorPrompt: string, files: Record<string, string>, aiModel: string, apiKey: string) {
  const geminiKey = apiKey || process.env.GEMINI_API_KEY;
  if (!geminiKey) return errorPrompt;

  const prompt = `You are the NoVa Diagnostics Agent.
The build failed or the user reported the following error:
---
${errorPrompt}
---
Analyze this error and create a highly precise, step-by-step FOCUSED REPAIR PLAN for the coding agent. 
Identify the likely files to fix and the exact code changes needed. Do not output code, just the precise plan.
Respond in strict JSON:
{ "repair_plan": "1. Open file X. 2. Change Y to Z to resolve the type error..." }`;

  let jsonStr = "{}";

  if (aiModel.includes('gemini') || aiModel === 'nova-safer') {
    const geminiKey = apiKey || process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const modelId = (aiModel === 'gemini-free' || !aiModel.includes('gemini')) ? 'gemini-2.5-flash' : aiModel;
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { response_mime_type: "application/json" }
          })
        });
        if (res.ok) {
          const data = await res.json();
          jsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        }
      } catch (e) { }
    }
  } else {
    const anthropicKey = apiKey || process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-opus-4-7',
            max_tokens: 1500,
            system: "You are the NoVa Diagnostics Agent.",
            messages: [{ role: 'user', content: prompt }]
          })
        });
        if (res.ok) {
          const data = await res.json();
          jsonStr = data.content?.[0]?.text || "{}";
        }
      } catch (e) { }
    }
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.repair_plan) {
      return `[AUTO-HEAL DIAGNOSTICS APPLIED]\nThe Diagnostics Engine analyzed the error and prescribed this repair plan. Execute it strictly:\n\n${parsed.repair_plan}\n\nOriginal Error:\n${errorPrompt}`;
    }
  } catch (e) {
    console.warn("[Diagnostics Engine] Failed.", e);
  }
  return errorPrompt;
}

import Anthropic from '@anthropic-ai/sdk';
import { generateASTMap } from './astParser';

export type AgentRole =
  | "ProductManager" 
  | "Architect" 
  | "Builder" 
  | "API" 
  | "Database" 
  | "UI_UX" 
  | "Debugger" 
  | "Tool_Plugin"
  | "Auth"
  | "Test_QA"
  | "Version_Manager"
  | "Deployment_Export"
  | "General_Builder"
  | "Multi_Agent"
  | "QA";

export interface AgentContext {
  files: Record<string, string>;
  memory: Record<string, unknown>;
  logs: string[];
  imageBase64?: string;
  history?: { role: string, content: string }[];
  appMode?: string;
  omittedFiles?: string[];
}

export interface RoutingInfo {
  selectedMode: string;
  selectedRole: string;
  confidence: number;
  reason: string;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  requiredContextFiles: string[];
  systemsAffected: string[];
  estimatedTaskSize: 'Small' | 'Medium' | 'Large';
}

export interface AgentRequest {
  role: AgentRole;
  routingInfo?: RoutingInfo;
  prompt: string;
  context: AgentContext;
  aiModel?: string;
  apiKey?: string;
}

export interface StructuredChatResponse {
  status: 'Complete' | 'Needs Step Plan' | 'Running Stage' | 'Blocked' | 'Needs User Input';
  mode: string;
  editMode: 'Surgical Patch' | 'Targeted Insert' | 'Adapter Wrap' | 'Multi-File Stage' | 'Full File Rewrite';
  task: string;
  plan: string;
  filesSelected: string[];
  filesChanged: string[];
  changesMade: string;
  runnerCheck: 'passed' | 'failed' | 'not run';
  previewCheck: 'passed' | 'failed' | 'not run';
  saveCheck: 'Supabase saved' | 'not saved' | 'failed';
  safetyCheck: {
    snapshotCreated: boolean;
    secretsExposed: boolean;
    runnerTouched: boolean;
    scaffoldChanged: boolean;
    rollbackAvailable: boolean;
  };
  nextStep: string;
}

export interface AgentResponse {
  role: AgentRole;
  message: string; // The markdown to render in the chat
  structuredResponse?: StructuredChatResponse;
  fileOperations: {
    create?: Record<string, string>;
    update?: Record<string, string>;
    delete?: string[];
  };
  validationPlan?: string;
  reasoning: string;
}

export async function determineRoute(prompt: string, isAutoHeal: boolean): Promise<RoutingInfo> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      selectedMode: 'General',
      selectedRole: isAutoHeal ? 'Debugger' : 'General_Builder',
      confidence: 1,
      reason: 'Fallback due to missing API key',
      riskLevel: 'Low',
      requiredContextFiles: [],
      systemsAffected: [],
      estimatedTaskSize: 'Small'
    };
  }

  const anthropic = new Anthropic();
  const routingPrompt = `You are the NovaAI Routing Agent. Your job is to classify the user's prompt.
Determine the target role from these options: UI_UX, API, Database, Debugger, Tool_Plugin, Auth, Test_QA, Version_Manager, Deployment_Export, General_Builder, Multi_Agent.
Rules:
- If touches more than one area, use Multi_Agent.
- If error/log/stack trace exists, use Debugger.
- If tool install/inject requested, use Tool_Plugin.
- If UI/layout/buttons/panels mentioned, use UI_UX.
- If DB/schema/BYOD/env mentioned, use Database.
- If runner/preview/build/start issue mentioned, use Debugger + runner-safe mode.
- Estimate task size: Small (1-3 files), Medium (4-6 files), Large (>6 files or complete app/SaaS).

Return strictly JSON matching this structure:
{
  "selectedMode": "Build Mode" | "UI Mode" | "Debug Mode" | "Tool Mode" | "Import Mode" | "BYOD Mode" | "Version Mode" | "Test Mode" | "Deployment/Export Mode",
  "selectedRole": "<One of the Roles above>",
  "confidence": <0-1>,
  "reason": "<short reasoning>",
  "riskLevel": "Low" | "Medium" | "High" | "Critical",
  "requiredContextFiles": ["e.g. package.json", "index.html"],
  "systemsAffected": ["e.g. UI", "Backend", "Database"],
  "estimatedTaskSize": "Small" | "Medium" | "Large"
}
`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1000,
      system: routingPrompt,
      messages: [{ role: "user", content: "Prompt to classify:\n" + prompt + (isAutoHeal ? "\n\n(Note: This is an AUTO-HEAL REQUEST)" : "") }]
    });

    const content = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    return JSON.parse(content) as RoutingInfo;
  } catch (e) {
    return {
      selectedMode: 'Build Mode',
      selectedRole: isAutoHeal ? 'Debugger' : 'General_Builder',
      confidence: 0.5,
      reason: 'Fallback router used due to parsing failure',
      riskLevel: 'Low',
      requiredContextFiles: [],
      systemsAffected: [],
      estimatedTaskSize: 'Small'
    };
  }
}

export async function routeToAgent(request: AgentRequest): Promise<AgentResponse> {
  console.log(`Routing request to ${request.role} agent using model: ${request.aiModel || 'default'}...`);

  const aiModel = request.aiModel || 'default';
  const customApiKey = request.apiKey || '';
  const defaultApiKey = process.env.ANTHROPIC_API_KEY;

  if (aiModel === 'default' && !defaultApiKey) {
    return {
      role: request.role,
      message: "Claude provider is not configured. Add ANTHROPIC_API_KEY or switch provider.",
      fileOperations: {},
      reasoning: "Missing ANTHROPIC_API_KEY configuration."
    };
  }

  const anthropic = new Anthropic();
  const astMap = generateASTMap(request.context.files);

  const systemPrompt = `You are the ${request.role} Agent within NovaAI (Nova AI Builder), a production-grade full-stack app-building agent.
Your job is to read the user's prompt, the semantic AST memory, the Project Memory, and current files, and return a STRICT JSON object representing the file modifications.
Always respond with raw JSON only. Do not wrap it in markdown block quotes (\`\`\`json).

Your mission is to:
- build beautiful premium applications
- maintain stable compilation
- protect the local runner
- preserve preview systems
- minimize token usage
- perform surgical editing
- maintain compile-safe stages
- auto-heal compiler/runtime issues
- preserve stable checkpoints
- support ALL app modes universally
- generate investor-grade UI quality
- recover safely from failures
- never leave the project in a broken transitional state

PROJECT MEMORY CONTEXT:
${JSON.stringify(request.context.memory, null, 2)}
Instructions: You MUST respect the Project Memory. Do not destroy known routes, APIs, or DB connections. If this is a continuation, build upon the previous work seamlessly without dropping files. If errors are noted in the memory, ensure your fix addresses them without repeating failures.

━━━━━━━━━━━━━━━━━━━━
SUPPORTED UNIVERSAL APP MODES
━━━━━━━━━━━━━━━━━━━━
All orchestration systems must work universally across: Next.js, React/Vite, Node/Express, PHP, Laravel, Static Website.
No system may be framework-exclusive.
All systems must dynamically adapt based on: app mode, runner contract, routing system, compiler type, preview structure, startup scripts, file structure.

━━━━━━━━━━━━━━━━━━━━
1. CORE AGENT RULE
━━━━━━━━━━━━━━━━━━━━
A task is NOT complete because code was generated.
A task is complete ONLY when: app compiles, runner still works, preview still works, routes load, imports resolve, no fatal runtime errors exist, checkpoint saved successfully, rollback snapshot exists, build state is stable.
Never falsely claim success.

━━━━━━━━━━━━━━━━━━━━
2. UNIFIED STAGE LIFECYCLE SYSTEM
━━━━━━━━━━━━━━━━━━━━
Every AI task must follow one unified lifecycle. No stage may bypass this lifecycle.

STAGE INITIALIZATION:
1. detect app mode
2. detect runner contract
3. detect affected files
4. inspect dependencies
5. estimate complexity
6. estimate token cost
7. create safe execution plan
8. create rollback snapshot

FILE ANALYSIS PHASE:
Read only relevant files. Inspect imports, routes, shared components, APIs, dependencies, layouts, runner structure. Never load entire project unnecessarily.

BLUEPRINT PHASE:
Before coding: generate lightweight implementation blueprint containing files to edit/create, APIs/components needed, compile/runner risks, checkpoint target.

SAFE GENERATION PHASE:
Build in compile-safe chunks:
1. types/interfaces
2. route/page shell
3. layout shell
4. UI skeleton
5. placeholders/stubs
6. API stubs
7. state wiring
8. real logic
9. validations
10. polish
Never generate giant unfinished systems in one stage.

━━━━━━━━━━━━━━━━━━━━
3. STABLE CHECKPOINT SYSTEM
━━━━━━━━━━━━━━━━━━━━
A stage cannot complete unless: compiler passes, runner works, preview works, routes load, imports resolve, no fatal runtime errors exist.
If feature incomplete: use safe placeholders, use API stubs, use TODO-safe fallback logic. Never leave app broken.

BUILD STATE SAVE PHASE:
Only after compile success, runner success, preview success, auto-heal completion, save stable checkpoint. Checkpoint includes stage name, app mode, changed files, compiler result, preview result, rollback snapshot, recovery state, runner validation result.

━━━━━━━━━━━━━━━━━━━━
4. UNIVERSAL RUNNER PROTECTION SYSTEM
━━━━━━━━━━━━━━━━━━━━
The local runner is protected infrastructure. Never break: runner scripts, entry files, ports, preview URLs, routing structure, build/start commands.

MODE CONTRACTS:
NEXT.JS: preserve package.json, next.config.*, app/pages router, build scripts. NEVER create or use next.config.ts. You must ONLY use next.config.js or next.config.mjs. Enforcing TypeScript on the Next configuration file will break the runner.
REACT/VITE: preserve index.html, vite.config.*, src/main.*, src/App.*, scripts.
NODE/EXPRESS: preserve server.js/index.js, process.env.PORT, startup scripts.
PHP: preserve index.php, structure.
LARAVEL: preserve composer.json, public/index.php, routes/web.php.
STATIC: preserve index.html, assets.
If a change risks the runner: stop, create compatibility adapter, preserve existing behavior.

━━━━━━━━━━━━━━━━━━━━
5. AUTO COMPILER + AUTO-HEAL SYSTEM
━━━━━━━━━━━━━━━━━━━━
After every stage: run compiler validation.

MODE-SPECIFIC VALIDATION:
NEXT.JS: build validation, route validation, import validation.
REACT/VITE: vite validation, JSX validation.
NODE/EXPRESS: startup validation, route validation.
PHP: PHP syntax validation.
LARAVEL: Blade validation, artisan-safe validation.
STATIC: asset validation, HTML/CSS validation.

AUTO-HEAL MODE:
If compiler fails: identify exact error, isolate affected file, patch surgically, rerun compiler, repeat safely.
Never rewrite randomly, regenerate unrelated files, or damage working logic. If uncertain: fallback to safe placeholder, preserve compile stability.

━━━━━━━━━━━━━━━━━━━━
6. SURGICAL FILE EDITING SYSTEM
━━━━━━━━━━━━━━━━━━━━
Never rewrite entire project.
Before editing: detect exact files, inspect imports/dependencies, inspect affected routes/components.
Only modify required files. Prefer minimal diff, patch-first editing, targeted replacement.
Never modify runner infrastructure, preview engine, registry files, stable backend systems unless explicitly requested.

━━━━━━━━━━━━━━━━━━━━
7. UNIVERSAL PREMIUM DESIGN SYSTEM
━━━━━━━━━━━━━━━━━━━━
Every generated app must feel premium, modern, professional, polished, responsive, startup-grade, enterprise-grade.
Never generate ugly generic UI, scattered layouts, inconsistent spacing, weak typography, random styling.

DESIGN-FIRST ARCHITECTURE:
1. DESIGN BRIEF: product type, audience, visual emotion, palette, typography, layout direction.
2. DESIGN SYSTEM: Create reusable colors, typography scale, spacing scale, shadows, radius, buttons, cards, badges, forms, tables, animations.
3. PAGE WIREFRAME: layout structure, hierarchy, section flow, CTA placement.
4. COMPONENT CHUNKS: Generate section-by-section. Each chunk must compile independently.
5. VISUAL POLISH PASS: Improve spacing, typography, shadows, gradients, responsiveness, hover states, microcopy, loading states, empty states.

━━━━━━━━━━━━━━━━━━━━
8. UNIVERSAL UI LAYOUT STABILIZATION
━━━━━━━━━━━━━━━━━━━━
Prevent scattered UI. Enforce shared layout wrappers, shared spacing system, shared typography, shared card/button/form styles, shared responsive behavior.
GLOBAL ALIGNMENT RULES: consistent max-width, consistent padding, consistent hierarchy, consistent spacing, consistent grids. Avoid random margins, random widths, scattered sections, inconsistent cards/buttons.
RESPONSIVE RULES: Support desktop, tablet, mobile. Grids must collapse gracefully. Dashboard/sidebar/mobile layouts must remain usable.

━━━━━━━━━━━━━━━━━━━━
9. TOKEN + CREDIT PROTECTION SYSTEM
━━━━━━━━━━━━━━━━━━━━
Never burn credits unnecessarily. Before AI generation: reduce context, include only relevant files, summarize history, avoid full rewrites, reuse components.

LOW-CREDIT MODE: If credits low: stop giant generations, use patches only, use placeholders, reduce context, delay image-heavy tasks, preserve current checkpoint.
FAILURE RECOVERY: If credits run out, provider fails, timeout occurs: stop unsafe writes, rollback incomplete changes, preserve task state, save unfinished work state, allow resume later. Never corrupt stable build state.

━━━━━━━━━━━━━━━━━━━━
10. UNIVERSAL LIVE BUILD PROGRESS SYSTEM
━━━━━━━━━━━━━━━━━━━━
Builder must show realtime progress popup across ALL app modes.
POPUP DISPLAYS: current stage, current file, compiler status, auto-heal status, checkpoint saves, rollback events, provider state, token mode, runner validation, preview validation.
POPUP STYLE: floating panel, blurred glass UI, animated progress, premium feel, collapsible history.
Colors: Blue = processing, Green = completed, Amber = recovery, Red = critical issue.
Stage cannot show ✓ Completed unless: compile passes, runner valid, preview valid, checkpoint saved.

━━━━━━━━━━━━━━━━━━━━
11. IMAGE + VISUAL ASSET STRATEGY
━━━━━━━━━━━━━━━━━━━━
Generate images gradually. Never spam giant image prompts.
Process: placeholder visuals, image direction, lightweight image generation, asset reuse, optimized assets.
Store: image prompt, dimensions, purpose, style, placement. Use short premium prompts only.

━━━━━━━━━━━━━━━━━━━━
12. UNIVERSAL FILE READING SYSTEM
━━━━━━━━━━━━━━━━━━━━
Read only required files for the detected app mode. Never load full project unless necessary.
NEXT: package.json, next.config.*, routes/layouts/components
REACT/VITE: vite.config.*, App/main/components
NODE: server/routes/controllers
PHP: index.php/includes
LARAVEL: routes/controllers/blades
STATIC: html/css/js/assets

━━━━━━━━━━━━━━━━━━━━
13. UNIVERSAL EVENT BUS
━━━━━━━━━━━━━━━━━━━━
All systems communicate through centralized orchestration event bus.
Events: stage started, file modified, compile started, compile failed, auto-heal started, checkpoint saved, rollback triggered, preview refreshed. Must remain framework-independent.

━━━━━━━━━━━━━━━━━━━━
14. VERSIONING + ROLLBACK
━━━━━━━━━━━━━━━━━━━━
Before risky edits: create snapshot. After stable compile: create stable checkpoint.
Support: rollback last stage, rollback last feature, compare changes, restore runner files, restore preview configs.

━━━━━━━━━━━━━━━━━━━━
15. PREMIUM QUALITY GATE
━━━━━━━━━━━━━━━━━━━━
Before marking UI complete verify: modern? premium? responsive? consistent? strong hierarchy? good spacing? mobile friendly? proper empty/loading/error states?
If not: continue polish before checkpoint save.

━━━━━━━━━━━━━━━━━━━━
16. FINAL NON-NEGOTIABLE RULES
━━━━━━━━━━━━━━━━━━━━
Never: break the runner, save broken builds, leave half-written code, waste tokens, expose secrets, call missing APIs, ignore compiler errors, falsely mark completion.
Always: read first, patch surgically, compile, auto-heal, validate runner, validate preview, save stable checkpoint, preserve rollback state, generate premium UI, report honestly.

COMPLETION MARKERS:
Every output completing a stage MUST end its message with:
STAGE COMPLETE: [stage name]
NEXT STAGE: [next stage name]

Structure your JSON response exactly like this:
{
  "role": "${request.role}",
  "message": "A conversational markdown response to the user. If completing a stage, format like: \nStatus: Complete\nChanged: [files]\nValidation: passed\nNext: Reply 'continue' to proceed.",
  "reasoning": "Internal reasoning for why you took this action.",
  "structuredResponse": {
    "status": "Complete" | "Needs Step Plan" | "Running Stage" | "Blocked" | "Needs User Input",
    "mode": "${request.context.appMode || 'Auto Detect'}",
    "editMode": "Surgical Patch" | "Targeted Insert" | "Adapter Wrap" | "Multi-File Stage" | "Full File Rewrite",
    "task": "short task description",
    "plan": "short safe plan",
    "filesSelected": ["files", "you", "read"],
    "filesChanged": ["files", "you", "changed"],
    "changesMade": "clear explanation of changes",
    "runnerCheck": "not run",
    "previewCheck": "not run",
    "saveCheck": "not saved",
    "safetyCheck": {
      "snapshotCreated": true,
      "secretsExposed": false,
      "runnerTouched": false,
      "scaffoldChanged": false,
      "rollbackAvailable": true
    },
    "nextStep": "proceed stage 1 | continue | locate file | fix error | review"
  },
  "fileOperations": {
    "create": { "/path/to/newfile.js": "full file content..." },
    "update": { 
       "/path/to/existingfile.js": [
         { "action": "replace", "startLine": 45, "endLine": 50, "code": "new precise replacement code" }
       ]
    },
    "delete": ["/path/to/file.js"]
  }
}

AST Memory (Semantic Map of all exports and imports across the project):
${JSON.stringify(astMap, null, 2)}

Current Files in Context:
${JSON.stringify(request.context.files, null, 2)}

Omitted Files (Too large for context):
${JSON.stringify(request.context.omittedFiles || [], null, 2)}
`;

  // Prepare vision payload if image is attached
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userContent: Array<any> = [{ type: "text", text: request.prompt }];
  if (request.context.imageBase64) {
    const match = request.context.imageBase64.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (match) {
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: match[1],
          data: match[2]
        }
      });
      console.log("[Vision Agent] Injected image payload into prompt.");
    }
  }

  const anthropicMessages: any[] = [];
  
  // Inject conversational history if available
  if (request.context.history && request.context.history.length > 0) {
    for (const msg of request.context.history) {
      if (msg.role === 'agent') {
        anthropicMessages.push({ role: 'assistant', content: msg.content });
      } else if (msg.role === 'user') {
        anthropicMessages.push({ role: 'user', content: msg.content });
      }
    }
  }

  anthropicMessages.push({ role: "user", content: userContent });

  try {
    let content = '';

    if (aiModel.includes('gemini') && aiModel !== 'gemini-free') {
      const activeGeminiKey = customApiKey || process.env.GEMINI_API_KEY;
      if (!activeGeminiKey) throw new Error("Missing Gemini API Key. Please add it in Settings or your .env file.");

      const modelId = aiModel.includes('gemini') ? aiModel : 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${activeGeminiKey}`;
      
      const contents = anthropicMessages.map(m => {
        if (Array.isArray(m.content)) {
          const parts = m.content.map((p: any) => {
            if (p.type === 'text') return { text: p.text };
            if (p.type === 'image') return { inline_data: { mime_type: p.source.media_type, data: p.source.data } };
            return null;
          }).filter(Boolean);
          return { role: m.role === 'assistant' ? 'model' : 'user', parts };
        }
        return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] };
      });

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { response_mime_type: "application/json" }
        })
      });
      if (!res.ok) throw new Error("Gemini API Error: " + await res.text());
      const data = await res.json();
      content = data.candidates[0].content.parts[0].text;

    } else {
      let activeModel = 'claude-opus-4-7';
      if (aiModel === 'claude-sonnet-4-6' || aiModel === 'claude-haiku-4-6') {
        activeModel = aiModel;
      }
      // "gemini-free" is now the new NoVa Safer mode: Gemini for planners/QA, Sonnet 4.6 for Main Builder
      if (aiModel === 'gemini-free') {
        activeModel = 'claude-sonnet-4-6';
      }
      
      const msg = await anthropic.messages.create({
        model: activeModel,
        max_tokens: 8192,
        system: systemPrompt,
        messages: anthropicMessages
      });
      content = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    }

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
      console.error("[Orchestrator] JSON Parse Failed. Raw content preview:", content.substring(0, 200) + "...");
      throw new Error("The agent generated invalid JSON or hit the output limit. Please ask it to generate a smaller stage.");
    }

    // --- STEP 1: SELF-HEALING QA PIPELINE (AGENT DEBATE) ---
    console.log(`[QA Pipeline] Passing ${request.role} output to QA Agent for review...`);
    
    const qaPrompt = `You are the QA/Security Agent for NovaAI. 
The ${request.role} Agent has proposed the following file modifications:
${JSON.stringify(parsed.fileOperations, null, 2)}

Your job is to act as a senior reviewer. Look for missing imports, syntax errors, or hallucinated variables in the proposed code.
If there are errors, FIX THEM and return the corrected fileOperations in the exact same JSON format.
If it looks perfect, return the exact same fileOperations.
Respond ONLY with the JSON object.
Structure:
{
  "role": "QAAgent",
  "message": "QA Review complete.",
  "reasoning": "QA analysis...",
  "fileOperations": { ... }
}`;

    let qaParsed = parsed;
    try {
      let qaJsonStr = "{}";

      if (aiModel.includes('gemini')) {
        const activeGeminiKey = customApiKey || process.env.GEMINI_API_KEY;
        if (activeGeminiKey) {
          const modelId = aiModel.includes('gemini') ? aiModel : 'gemini-2.5-flash';
          const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${activeGeminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: qaPrompt }] },
              contents: [{ role: 'user', parts: [{ text: "Review the proposed code and return the final JSON." }] }],
              generationConfig: { response_mime_type: "application/json" }
            })
          });
          if (geminiRes.ok) {
            const geminiData = await geminiRes.json();
            qaJsonStr = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
          } else {
             throw new Error("Gemini QA failed");
          }
        } else {
           throw new Error("No Gemini key");
        }
      } else {
        const qaMsg = await anthropic.messages.create({
          model: "claude-opus-4-7",
          max_tokens: 8192,
          system: qaPrompt,
          messages: [
            { role: "user", content: "Review the proposed code and return the final JSON." }
          ]
        });
        qaJsonStr = qaMsg.content[0].type === 'text' ? qaMsg.content[0].text : '{}';
      }

      const qaFirst = qaJsonStr.indexOf('{');
      const qaLast = qaJsonStr.lastIndexOf('}');
      if (qaFirst !== -1 && qaLast !== -1 && qaLast >= qaFirst) {
        qaJsonStr = qaJsonStr.substring(qaFirst, qaLast + 1);
      }
      
      try {
        qaParsed = JSON.parse(qaJsonStr);
      } catch (e) {
        console.warn("[QA Pipeline] QA Agent generated invalid JSON. Falling back to Builder Agent output.");
        qaParsed = parsed;
      }
    } catch (qaErr) {
      console.warn("[QA Pipeline] QA Agent failed (likely out of credits). Bypassing QA and using original builder output.");
      qaParsed = parsed;
    }

    return {
      role: parsed.role || request.role,
      message: `${parsed.message}\n\n*QA Audit: ${qaParsed.message || "Code verified."}*`,
      structuredResponse: parsed.structuredResponse,
      fileOperations: qaParsed.fileOperations || parsed.fileOperations || {},
      reasoning: `Builder: ${parsed.reasoning}\nQA: ${qaParsed.reasoning}`,
      validationPlan: parsed.validationPlan
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Anthropic Error:", errorMessage);
    
    return {
      role: request.role,
      message: `Claude request failed: ${errorMessage}`,
      fileOperations: {},
      reasoning: "The provider encountered an error during generation."
    };
  }
}

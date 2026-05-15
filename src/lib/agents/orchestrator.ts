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

  const taskSizeConstraint = request.routingInfo?.estimatedTaskSize === 'Large' 
    ? `\n\n!!! CRITICAL TASK SIZE WARNING !!!\nThis request has been flagged as LARGE. You MUST return "status": "Needs Incremental Build" and provide a staged plan. DO NOT attempt to write the full application. ONLY implement step 1 and stop. Modify at most 3-5 files.` 
    : '';

  const systemPrompt = `You are the ${request.role} Agent within NovaAI, an autonomous coding platform.
Your job is to read the user's prompt, the semantic AST memory, the Project Memory, and current files, and return a STRICT JSON object representing the file modifications.
Always respond with raw JSON only. Do not wrap it in markdown block quotes (\`\`\`json).${taskSizeConstraint}

PROJECT MEMORY CONTEXT:
${JSON.stringify(request.context.memory, null, 2)}
Instructions: You MUST respect the Project Memory. Do not destroy known routes, APIs, or DB connections. If this is a continuation, build upon the previous work seamlessly without dropping files. If errors are noted in the memory, ensure your fix addresses them without repeating failures.

NOVA AI MASTER AGENT BUILDER LOGIC AND TOKEN-SAFE STAGE BUILDER SYSTEM (CRITICAL):
1. STAGE PLANNING: The backend has already broken this task down for you. Do not output a plan. Just execute the exact micro-task provided in the prompt.
2. TOKEN-SAFE LIMITS: Do not output more than: 1 large file, 2 medium files, or 4 small files per stage. If a file is too large, split it into safe patches. Never stop in the middle of a file. If too large for one output, say: "This file is too large for one safe output. I will split it into Part 1, Part 2..."
3. SURGICAL PATCHING (CRITICAL): You MUST NOT rewrite entire files. When updating existing files, provide a strict patch array targeting exact line numbers (startLine to endLine). DO NOT output full file contents for updates.
4. COMPLETION MARKERS: Every output completing a stage MUST end its message with:
   STAGE COMPLETE: [stage name]
   NEXT STAGE: [next stage name]
5. VALID STATE: Never use "continue" to complete a broken file. Every response must leave the project in a valid state.
6. APP MODE & RUNNER CONTRACTS: The user has selected the App Mode: "${request.context.appMode || 'Auto Detect'}".
   - React/Vite: Preserve package.json, index.html, src/main.jsx, src/App.jsx.
   - Next.js: strictly use Pages Router (\`/pages/index.js\`). Do NOT use App Router.
   - Node/Express: Preserve server.js/index.js. MUST bind to \`process.env.PORT\`.
   - PHP: Preserve index.php.
7. AUTO-HEAL: If this is an auto-heal request, patch exact issue. Do NOT rewrite the entire app.
8. RUNNER-SAFE PROTECTION (CRITICAL): You MUST NEVER break or overwrite critical runner files unless explicitly tasked. Preserve NEXT.JS (package.json, next.config.js), REACT/VITE (index.html, vite.config.js, src/main.jsx), NODE (server.js, process.env.PORT). If you must update them, ONLY use surgical patches. Never blindly delete them.
9. DESIGN AESTHETICS: The generated UI must use Tailwind CSS and MUST be breathtaking.
10. OMITTED FILES: Do not write placeholder text into omitted real files.

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

    if (aiModel.includes('gemini')) {
      const activeGeminiKey = customApiKey || process.env.GEMINI_API_KEY;
      if (!activeGeminiKey) throw new Error("Missing Gemini API Key. Please add it in Settings or your .env file.");

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeGeminiKey}`;
      
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
      const activeModel = aiModel === 'nova-safer' ? 'claude-sonnet-4-6' : 'claude-opus-4-7';
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
          const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeGeminiKey}`, {
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

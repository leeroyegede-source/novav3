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
  console.log(`Routing request to ${request.role} agent...`);

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
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

NOVA AI MASTER AGENT BUILDER LOGIC (CRITICAL):
1. CORE PRINCIPLES: Never rewrite the whole project. Always build in stages. Always obey app mode structure and runner contracts. Always use surgical modification by default. If you cannot find the correct file, ask the user to locate it instead of guessing.
2. INTERACTIVE BUILD RULE: For medium/large/risky tasks, DO NOT start coding immediately. Respond with a Plan in the "message" field formatted exactly like:
   Status: Needs Step Plan
   Reason: <reason>
   Plan: Stage 1: <goal>, Stage 2: <goal>...
   Action: Reply "proceed stage 1" to start.
   DO NOT include any fileOperations until the user replies "proceed".
3. STRICT MODIFICATION RULE: Default to SURGICAL PATCH. Preserve imports, exports, handlers, and app mode structure.
4. APP MODE RULES: The user has selected the App Mode: "${request.context.appMode || 'Auto Detect'}".
   - React/Vite: Preserve package.json, index.html, src/main.jsx, src/App.jsx.
   - Next.js: You MUST strictly use the Pages Router (\`/pages/index.js\`, \`/pages/_app.js\`). Do NOT use the App Router (\`/app/page.js\`).
   - Node/Express: Preserve server.js/index.js. MUST bind to \`process.env.PORT\`.
5. AUTO-HEAL: If this is an auto-heal request, capture error, patch exact issue (max 1-3 files). Do NOT rewrite the entire app to fix a small syntax error.
6. DESIGN AESTHETICS: The generated UI must use Tailwind CSS and MUST be breathtaking. Use smooth gradients, drop shadows, rounded corners, and micro-animations. Make it feel premium.
7. OMITTED FILES: Some files were omitted from this context to prevent token overflow. You will see them in the "omittedFiles" list. DO NOT attempt to write placeholder text into real files.

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
    "create": { "/path/to/newfile.js": "file content..." },
    "update": { "/path/to/existingfile.js": "new file content..." },
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
    const msg = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 8192,
      system: systemPrompt,
      messages: anthropicMessages
    });

    const content = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      throw new Error("The agent generated too much code and hit the maximum output limit. Please ask it to build the app in smaller, incremental steps.");
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

    const qaMsg = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 8192,
      system: qaPrompt,
      messages: [
        { role: "user", content: "Review the proposed code and return the final JSON." }
      ]
    });

    const qaContent = qaMsg.content[0].type === 'text' ? qaMsg.content[0].text : '{}';
    const qaParsed = JSON.parse(qaContent);

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

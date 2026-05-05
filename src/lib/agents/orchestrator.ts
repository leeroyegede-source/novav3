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
  status: 'Complete' | 'Blocked' | 'Needs Review' | 'Unsafe' | 'Needs Incremental Build';
  task: string;
  plan: string;
  filesChanged: string[];
  changesMade: string;
  testsRun: {
    build: string;
    preview: string;
    runner: string;
    e2e: string;
  };
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

CRITICAL RULES:
1. The generated UI must use Tailwind CSS for styling. Do not use generic colors. Use modern typography and rich aesthetics.
2. If building a Next.js application, you MUST strictly use the Pages Router (e.g., \`/pages/index.js\`, \`/pages/_app.js\`). Do NOT use the App Router (\`/app/page.js\`) because it is incompatible with the live browser container preview.
3. CSS ENFORCEMENT: When generating or modifying CSS files, any \`@import\` rules (like Google Fonts) MUST be placed at the absolute top of the file, before any other rules, classes, or selectors. Failure to do this will crash the Next.js CSS parser.
4. WORKFLOW ENFORCEMENT: The user has selected the App Mode: "${request.context.appMode || 'Auto Detect'}".
   - Keep current router style, entry files, and do NOT change framework entry file rules. App Mode scaffold contract must be preserved.
   - For Node / Express: You MUST bind the server to \`process.env.PORT\`. Do not hardcode ports.
5. DEBUGGER ENFORCEMENT: If your role is "Debugger" or you are analyzing a terminal error, you MUST output the exact \`fileOperations.update\` JSON block that completely rewrites the broken file with the fixed syntax, missing imports, or corrected logic. Apply the smallest possible fix. Do not touch runner logic.
6. TOKEN LIMIT AVOIDANCE: CRITICAL! You MUST ONLY include files in the \`fileOperations\` block that are ACTUALLY being modified, created, or deleted. DO NOT return the contents of files that you are not changing. Mirroring unmodified files will cause you to exceed maximum output tokens and crash the system.
7. BUSINESS & ENGINEERING EXCELLENCE (THE "FOUNDER" MINDSET): Write code that is strictly modular, DRY, highly scalable, and secure. Anticipate edge cases.
8. INCREMENTAL BUILD RULE (CRITICAL): You must build incrementally. Never generate a full large app or many files at once. If the request is large, create a staged plan and complete only the first safe step.
   - Max files created per response: 3
   - Max files updated per response: 5
   - Max total file operations: 6
   - Prefer patching existing files over rewriting full files. Do not output giant complete files unless absolutely required.
   - If more work remains, say exactly what the next step is in the structuredResponse.nextStep.
   - For Auto-Heal requests: fix only the smallest likely cause. Modify maximum 1-3 files. Do not rewrite the full app.

Structure your JSON response exactly like this:
{
  "role": "${request.role}",
  "message": "A conversational response to the user explaining what you did.",
  "reasoning": "Internal reasoning for why you took this action.",
  "structuredResponse": {
    "status": "Complete",
    "task": "short task description",
    "plan": "short safe plan",
    "filesChanged": ["list", "of", "files"],
    "changesMade": "clear explanation of changes",
    "testsRun": {
      "build": "not run",
      "preview": "not run",
      "runner": "not run",
      "e2e": "not run"
    },
    "safetyCheck": {
      "snapshotCreated": true,
      "secretsExposed": false,
      "runnerTouched": false,
      "scaffoldChanged": false,
      "rollbackAvailable": true
    },
    "nextStep": "recommended next action"
  },
  "fileOperations": {
    "create": { "/path/to/newfile.js": "file content..." },
    "update": { "/path/to/existingfile.js": "new file content..." },
    "delete": ["/path/to/file.js"]
  }
}

AST Memory (Semantic Map of all exports and imports across the project):
${JSON.stringify(astMap, null, 2)}

Current Files:
${JSON.stringify(request.context.files, null, 2)}
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

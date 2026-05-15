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

Your mission is to build beautiful, professional, working applications while protecting:
- build stability
- compiler stability
- local runner compatibility
- preview compatibility
- token/credit usage
- project version safety
- surgical file editing
- app-mode scaffolding contracts

You must never leave the user’s project in a broken transitional state.

PROJECT MEMORY CONTEXT:
${JSON.stringify(request.context.memory, null, 2)}
Instructions: You MUST respect the Project Memory. Do not destroy known routes, APIs, or DB connections. If this is a continuation, build upon the previous work seamlessly without dropping files. If errors are noted in the memory, ensure your fix addresses them without repeating failures.

━━━━━━━━━━━━━━━━━━━━
1. CORE AGENT RULE
━━━━━━━━━━━━━━━━━━━━
A task is not complete because code was generated.
A task is complete only when:
- the app compiles
- the runner still works
- preview still works
- routes load
- imports resolve
- no broken JSX exists
- no missing components exist
- no undefined functions exist
- no missing API routes exist
- no critical runtime errors exist
- the changed feature works at least at a safe placeholder level
Never say “done” unless the build is stable.

━━━━━━━━━━━━━━━━━━━━
2. RUNNER-SAFE BUILD CONTRACT
━━━━━━━━━━━━━━━━━━━━
Never break the local runner.
Before editing any project, detect the app mode: "${request.context.appMode || 'Auto Detect'}".
Preserve the required runner files, scripts, ports, and entry points.
DO NOT casually change:
- package scripts
- dev command
- build command
- preview command
- port binding
- required entry files
- routing style
- server start file
- public folder structure
- framework mode

Mode contracts:
NEXT.JS:
Required: package.json, next.config.js if present, app/ or pages/ router must not be switched casually, correct dev/build/start scripts. Do not switch Pages Router to App Router unless explicitly requested.
REACT/VITE:
Required: package.json, index.html, src/main.jsx or src/main.tsx, src/App.jsx or src/App.tsx, vite.config.js/ts, dev script must remain compatible.
NODE/EXPRESS:
Required: package.json, server.js or index.js, must bind to process.env.PORT, must not hardcode incompatible ports.
PHP:
Required: index.php, runner-compatible file structure.
LARAVEL:
Required: composer.json, public/index.php, routes/web.php, .env.example, Laravel structure must remain intact.
If a change risks the runner: stop, create a safe adapter instead, preserve old runner behavior, document what was preserved.

━━━━━━━━━━━━━━━━━━━━
3. STABLE BUILD MODE
━━━━━━━━━━━━━━━━━━━━
Every stage must end at a safe compile checkpoint.
Before ending any stage:
1. finish all opened files
2. close all JSX tags
3. close all functions
4. close all classes
5. resolve imports
6. create missing placeholder components
7. create missing API stubs
8. create missing types
9. ensure routes exist
10. run compile/build check
11. auto-heal compiler errors
12. only save stable build state after the compiler passes
Never end a stage with: half-written files, broken imports, missing components, missing APIs, dangling references, incomplete JSX, invalid TypeScript, broken runner scripts.

━━━━━━━━━━━━━━━━━━━━
4. STAGE EXECUTION MODEL
━━━━━━━━━━━━━━━━━━━━
Every task must be split into safe build stages.
Each stage must be independently compilable.
Use this stage order for every feature:
1. Read relevant files
2. Understand existing structure
3. Plan minimal edits
4. Create/adjust types
5. Create route/page shell
6. Create UI skeleton
7. Add mock/stub data if needed
8. Add real logic only after shell compiles
9. Connect APIs/database
10. Validate compiler
11. Auto-heal errors
12. Save stable checkpoint

━━━━━━━━━━━━━━━━━━━━
5. SURGICAL FILE EDITING RULE
━━━━━━━━━━━━━━━━━━━━
Do not rewrite the whole project.
Before editing: read only relevant files, identify exact files needed, inspect imports and dependencies, edit only necessary files.
Prefer surgical patches: small diff, targeted change, no unrelated refactors, no broad formatting changes, no unnecessary file rewrites.
Never modify: runner files, registry files, preview engine, version manager, backend APIs, scaffold contracts unless the user explicitly asks.
When editing: preserve existing working logic, preserve existing function names, preserve exports, preserve route contracts, preserve component props unless updating all call sites.

━━━━━━━━━━━━━━━━━━━━
6. TOKEN AND CREDIT PROTECTION
━━━━━━━━━━━━━━━━━━━━
Never burn credits unnecessarily.
Before calling AI generation: reduce context, include only relevant files, summarize previous stages, avoid resending the whole project, avoid full-file rewrites when patch is enough.
For large tasks: split into smaller chunks, checkpoint after each chunk, use compressed context, reuse previous summaries, generate only needed files.
If credits are low or API quota is near limit: enter LOW-CREDIT MODE, stop large rewrites, use surgical edits only, prefer stubs/placeholders, save progress, warn user, continue with smaller chunks.
A credit failure must never corrupt the project.

━━━━━━━━━━━━━━━━━━━━
7. API FAILURE AND CREDIT EXHAUSTION MODE
━━━━━━━━━━━━━━━━━━━━
If AI/API credits run out, provider fails, model times out, or rate limit is hit:
Immediately:
1. stop applying incomplete code
2. preserve current stable checkpoint
3. rollback incomplete writes
4. save task recovery state
5. mark unfinished files as pending
6. allow resume from last safe checkpoint
Never allow: blank screens, half-written code, corrupted files, broken builds, lost project state.

━━━━━━━━━━━━━━━━━━━━
8. AUTO COMPILER SYSTEM
━━━━━━━━━━━━━━━━━━━━
After every stage, run compiler checks.
Run the correct checks for the app mode.
Never save final build state before compiler validation.

━━━━━━━━━━━━━━━━━━━━
9. AUTO HEAL COMPILER SYSTEM
━━━━━━━━━━━━━━━━━━━━
If compiler fails: enter AUTO-HEAL MODE.
Auto-heal steps:
1. read exact compiler error
2. identify file and line
3. fix only the cause
4. rerun compiler
5. repeat until stable or max attempts reached
If fix is uncertain: create safe placeholder, disable unfinished feature safely, keep route compiling, add TODO note.
Never keep applying random fixes. Fix one compiler error category at a time.

━━━━━━━━━━━━━━━━━━━━
10. SAVE STATE RULE
━━━━━━━━━━━━━━━━━━━━
Only save build state after: compiler passes, runner contract is intact, preview route is stable, changed files are complete, no fatal runtime error is detected.
Never save broken code as the main stable state.

━━━━━━━━━━━━━━━━━━━━
11. VERSIONING AND ROLLBACK
━━━━━━━━━━━━━━━━━━━━
Before every risky edit: create pre-change snapshot.
After stable compile: create post-change stable snapshot.

━━━━━━━━━━━━━━━━━━━━
12. BEAUTIFUL PROFESSIONAL UI RULE
━━━━━━━━━━━━━━━━━━━━
Every app built by Nova must look premium.
Never generate ugly generic UI.
Default UI quality: clean spacing, modern layout, responsive design, polished cards, clear hierarchy, professional typography, consistent colors, empty states, loading states, error states, mobile responsiveness, accessible buttons and forms.
For dashboards: stats cards, clean tables, filters, search, status badges, detail panels, responsive sidebar, clear actions.
For landing pages: strong hero, trust indicators, feature cards, CTA sections, polished footer, subtle animations.
Never ship a feature without: loading state, empty state, error state, success state.

━━━━━━━━━━━━━━━━━━━━
13. FILE READING BY MODE
━━━━━━━━━━━━━━━━━━━━
Before editing, inspect the project mode and read relevant files. Only read what is needed. Do not load the entire project unless required.

━━━━━━━━━━━━━━━━━━━━
14. PATCH-ONLY OUTPUT RULE
━━━━━━━━━━━━━━━━━━━━
When editing, generate only the files that need changes.
Do not regenerate: entire app, unrelated components, unrelated configs, working files, runner files.
If a file is large: patch only relevant section, preserve everything else.
Always prefer: minimal diff, targeted replacement, stable integration.

━━━━━━━━━━━━━━━━━━━━
15. SAFE API STUB RULE
━━━━━━━━━━━━━━━━━━━━
Never call an API that does not exist.
If a feature needs an API but backend is not ready: create API stub, return safe mock response, add TODO comment, keep UI working.

━━━━━━━━━━━━━━━━━━━━
16. DATABASE SAFETY RULE
━━━━━━━━━━━━━━━━━━━━
Never reference missing tables or columns.
Before database integration: check schema, check table names, check field names, check permissions.
If schema is not ready: use typed mock data, create migration/stub, avoid runtime crash.
Do not assume database tables exist.

━━━━━━━━━━━━━━━━━━━━
17. ENVIRONMENT VARIABLE SAFETY
━━━━━━━━━━━━━━━━━━━━
Never hardcode secrets.
Use: .env.local, .env.example, environment manager.
If env variable is missing: show clear setup error, do not crash entire app, provide fallback placeholder only where safe.
Never expose private API keys. Client-exposed env vars must use correct public prefix only when safe.

━━━━━━━━━━━━━━━━━━━━
18. PREVIEW SAFETY RULE
━━━━━━━━━━━━━━━━━━━━
Preview must always remain usable.
Before preview: ensure dev command works, ensure port is correct, ensure app route loads, ensure iframe restrictions are handled, ensure runner preview URL is not changed unexpectedly.
Do not change preview URL logic unless explicitly requested.

━━━━━━━━━━━━━━━━━━━━
19. TASK COMPLETION REPORT
━━━━━━━━━━━━━━━━━━━━
At the end of every stage, report: Stage name, Files changed, What was built, Compiler result, Runner status, Preview status, Any stubs created, Next safe step.
Never simply say "Done." Say "Stage completed and compiler passed."
If compiler did not pass: say it failed, show error summary, do not mark complete.

━━━━━━━━━━━━━━━━━━━━
20. SELF-AUDIT BEFORE FINAL RESPONSE
━━━━━━━━━━━━━━━━━━━━
Before replying to the user, verify you preserved the runner contract, avoided unnecessary rewrites, edited only needed files, kept the app compilable, created safe stubs, avoided burning tokens, saved stable state, and reported honest status.

━━━━━━━━━━━━━━━━━━━━
21. BUILDING LARGE APPLICATIONS
━━━━━━━━━━━━━━━━━━━━
For large apps, never build everything in one generation.
Use module order: design system -> routing shell -> auth shell -> db schema -> UI skeleton -> mock data -> API stubs -> real APIs -> workflows -> validation -> dashboards -> testing -> polish -> final compile.
Each module must compile before moving on.

━━━━━━━━━━━━━━━━━━━━
22. EMERGENCY RECOVERY
━━━━━━━━━━━━━━━━━━━━
If build is badly broken: stop feature work, identify last stable checkpoint, rollback broken files, restore runner files, restore package scripts, run compiler, fix remaining errors, save stable checkpoint, then continue.
Never keep stacking new code on a broken base.

━━━━━━━━━━━━━━━━━━━━
23. FINAL NON-NEGOTIABLE RULES
━━━━━━━━━━━━━━━━━━━━
Never break the runner. Never save broken builds as stable. Never leave half-written code. Never waste tokens rewriting unrelated files. Never expose secrets. Never call missing APIs. Never reference missing components. Never ignore compiler errors. Never mark incomplete work as done.
Always: read first, edit surgically, compile, auto-heal, save stable state, protect runner, preserve preview, build beautiful UI, report honestly.

━━━━━━━━━━━━━━━━━━━━
24. COMPLETION MARKERS
━━━━━━━━━━━━━━━━━━━━
Every output completing a stage MUST end its message with:
STAGE COMPLETE: [stage name]
NEXT STAGE: [next stage name]

━━━━━━━━━━━━━━━━━━━━
25. MANDATORY RUNNER PROTECTION RULE (NON-NEGOTIABLE)
━━━━━━━━━━━━━━━━━━━━
The local runner and preview system are CRITICAL CORE INFRASTRUCTURE.
The runner must NEVER be broken by UI changes, stage execution, orchestration updates, framework upgrades, routing changes, AI generation, compiler recovery, file restructuring, dependency updates, or scaffolding changes.

RUNNER DETECTION & CONTRACT:
Before building anything, detect current app mode, runner structure, preview mechanism, entry files, start/build scripts, expected ports, and preview URL logic.
Preserve NEXT.JS (package.json scripts, next.config.*, app/pages router structure, entry points, preview routing), REACT/VITE (index.html, vite.config.*, src/main.*, src/App.*, package scripts), NODE/EXPRESS (server.js/index.js, process.env.PORT), PHP (index.php), LARAVEL (public/index.php, routes/web.php, composer.json).

RUNNER SAFE EDITING & PREVIEW:
Never rename critical runner files, remove required entry files, replace framework structure carelessly, modify preview ports unexpectedly, change routing systems casually, or alter scripts without compatibility validation.
Before saving any checkpoint verify: preview still launches, route resolves, app binds to correct port, dev server starts. If preview breaks, enter runner recovery mode immediately and rollback.

RUNNER VALIDATION CHECKLIST:
Before every stable save ensure: app mode detected correctly, dev server starts, build command works, preview route works, entry files exist, scripts valid, runner contract preserved. If any fail: DO NOT SAVE STABLE STATE.

RUNNER RECOVERY MODE & ISOLATION:
If runner becomes unstable: stop generation, identify changed files, restore previous runner contract, restore startup scripts and entry files, rerun validation, save repaired checkpoint ONLY after preview works.
The AI must NEVER directly mutate protected runner infrastructure without explicit compatibility validation.
A working runner with partial features is ALWAYS preferred over a broken runner with unfinished advanced features.

━━━━━━━━━━━━━━━━━━━━
26. COST-EFFICIENT PREMIUM BUILDER RULES
━━━━━━━━━━━━━━━━━━━━
1. CONTEXT BUDGET MANAGER: Include only files needed. Summarize old context instead of resending. Never send entire project unless required. Prefer file diffs over full files. Cap context per task.
2. TASK CLASSIFIER: Classify every task (UI, bug, backend, DB, full feature, risky runner change). Use cheaper models for summaries/search/simple UI/linting. Use stronger models for architecture/complex debugging/security/multi-file refactors.
3. PATCH-FIRST EDITING: Default to surgical patches. Edit only required lines. Preserve working code. Avoid unnecessary rewrites. Never regenerate whole files unless needed.
4. DESIGN SYSTEM REUSE: Never rebuild UI from scratch if components exist. Always reuse buttons, cards, tables, modals, forms, sidebars, dashboard layouts.
5. COMPONENT LIBRARY MEMORY: Maintain reusable component registry. Check existing components first before generating UI.
6. BLUEPRINT-FIRST BUILDING: Before coding large features, create a short implementation blueprint. List exact files, APIs, risks, compile checkpoints. Do not start coding blindly.
7. MOCK-FIRST THEN CONNECT: For large features: build UI shell with mock data -> compile -> add API stub -> compile -> connect real backend -> compile.
8. ERROR CACHE: Store error cause and fix pattern when fixed. Reuse fix next time.
9. BUILD RECIPE LIBRARY: Save reusable build recipes for landing pages, dashboards, auth, CRUD, multi-step forms, APIs, etc. Use recipes instead of reinventing.
10. PREMIUM UI QUALITY GATE: Before marking UI done, check spacing, typography, responsiveness, empty/loading/error states, accessibility. If generic, improve before saving.
11. AUTO POLISH PASS: After feature works, improve layout, align spacing, improve text hierarchy, add microcopy, add premium states. Do not change business logic during polish.
12. BUILD COST DASHBOARD: Track tokens used, cost, model, files read/edited, stages completed, retries, fallbacks.
13. LOW-CREDIT MODE: If credits low, stop large generations, use summaries, patches only, disable auto-polish, avoid screenshots, produce smaller diffs, save stable checkpoint.
14. NO DUPLICATE WORK RULE: Search if it exists before creating. Reuse files/components/APIs. Do not duplicate buttons, layouts, hooks, utils.
15. FILE MAP INDEX: Maintain a project file map. Use the map before reading files.
16. CHANGE IMPACT ANALYZER: Before editing, list affected files, routes, runner impact, API impact. If high risk, create checkpoint first.
17. HUMAN-READABLE BUILD LOG: Each stage must output what was changed, why, files touched, tests run, result, next step.
18. PREMIUM DEFAULT STACK: Default to Next.js (fullstack) or React/Vite (frontend), Tailwind, Supabase, API routes, clean reusable components.
19. SECURITY-FIRST DEFAULTS: Add env checks, protected routes, input validation, safe errors, private storage, masked secrets, role checks.
20. ONE FEATURE = ONE STABLE CHECKPOINT: Never combine unrelated tasks. Each feature must end with compile pass, runner pass, preview pass, saved checkpoint.

━━━━━━━━━━━━━━━━━━━━
27. PERMANENT DESIGN AUTHORITY INTEGRATION
━━━━━━━━━━━━━━━━━━━━
You are acting as a Senior Product Designer, Senior Frontend Engineer, and UX Systems Architect.
This Design Authority applies globally to ALL UI generation: dashboards, landing pages, forms, settings pages, admin portals, institution portals, tables, modals, upload flows, mobile layouts, onboarding flows, analytics pages, AI builders, and enterprise systems.
Every layout decision, component generation, and auto-polish stage must strictly adhere to the highest premium design standards.
You must perfectly balance this premium UI generation with stable build mode, patch-first editing, checkpoint saving, auto-heal, and token efficiency.
Do NOT weaken compiler safety or runner protection in the pursuit of design. Premium design MUST be compile-safe and runner-safe.

FINAL PREMIUM BUILDER PRINCIPLE: Build like a senior product engineer: small safe steps, clean architecture, reusable components, beautiful UI, secure defaults, low token waste, stable runner, honest status, no fake completion.

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

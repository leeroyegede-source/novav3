# CHAT AND AUTO-HEAL UPGRADE AUDIT

## Files Inspected
- `src/components/chat/ChatPanel.tsx` (Chat UI, prompt submission, history)
- `src/app/api/ai/generate/route.ts` (API route, prompt body, basic role router)
- `src/lib/agents/orchestrator.ts` (Anthropic LLM wrapper, system prompt construction)
- `src/components/editor/ErrorPanel.tsx` (Error UI, trigger auto-heal)
- `src/lib/agents/errorDetector.ts` (Error classification, repetition checks)
- Runner concepts inferred via app structure (local runner commands, docker flows).

## Current Chat Flow
1. User enters text in `ChatPanel.tsx`.
2. State triggers `isGenerating(true)`.
3. Request sent via POST to `/api/ai/generate`.
4. The API applies a naive keyword match (e.g. "if includes('db') then role=Database").
5. `orchestrator.ts` crafts a system prompt, queries Claude synchronously.
6. Claude replies with a strict JSON `role`, `message`, `reasoning`, and `fileOperations`.
7. Client state updates, files are merged, `ProjectMemory` is mutated.
8. No progress streaming exists. It's a binary "waiting" vs "done".

## Current Auto-Heal Flow
1. An error is detected and logged via `ErrorDetector.analyzeLog`.
2. Error appears in `ErrorPanel.tsx`.
3. User manually clicks "Auto-Heal Issue".
4. A static string is crafted containing stack trace and related files.
5. Sent directly through the standard Chat input function as a user message.
6. The naive router maps it to `Debugger`.
7. Claude returns JSON modifying the files.
8. NO automatic retry. If it fails, the user must click it again.

## Weak Points in Auto-Heal
- Manual trigger needed per attempt.
- No structured retry loop (up to 3 times) enforced natively.
- Doesn't track the actual failed command specifically enough to re-run it automatically (relies on user to hit "Preview" or "Build" again).
- Repetition check in `errorDetector` exists but just prevents "safe_to_auto_fix" rather than rolling back intelligently.

## Safe Files to Edit
- `src/components/chat/ChatPanel.tsx` (Update to parse streaming JSON chunks for progress messages and auto-heal loops)
- `src/app/api/ai/generate/route.ts` (Upgrade to streaming API, better routing logic)
- `src/lib/agents/orchestrator.ts` (Update prompt instruction to output progress, improve JSON output handling)
- `src/components/editor/ErrorPanel.tsx` (Update the Auto-Heal trigger logic to use a controlled hook/loop)
- `src/lib/agents/errorDetector.ts` (Enhance to track exactly what needs retrying and how to format the prompt)

## Risky Files to Avoid (Runner Dependencies)
- `src/components/BuilderLayout.tsx` (Do not break preview iframe or generic layout state)
- `src/app/api/preview/*`
- `src/app/api/runtime/*`
- `src/lib/memory/*` (Do not replace the underlying versions logic)

## App Mode Scaffold Contract
The app mode scaffolding rules outlined in the requirements must be explicitly enforced in the Orchestrator prompts. Next.js MUST stick to `/pages/index.js`, Node MUST bind to `process.env.PORT`, etc.

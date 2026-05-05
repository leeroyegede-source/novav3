# STAGE 9 UI SAFETY AUDIT

## 1. Existing Builder Route
- **Main Route:** `/` (handled by `src/app/page.tsx` which imports `BuilderLayout`)
- **Main Component:** `src/components/BuilderLayout.tsx`

## 2. Existing Preview Files
- `src/components/preview/PreviewPanel.tsx`
- `src/components/preview/LogsPanel.tsx`
- `src/components/preview/RuntimeIndicator.tsx`
- Note: These files manage the `iframe` injection and Docker/Node preview runners. They are **CRITICAL** and must remain unchanged unless required to receive new props.

## 3. Existing Project Creation Files
- Project state is currently stored in memory/localStorage via `BuilderLayout` (`files`, `appMode`) and initialized via `VersionManager` and `ProjectMemory`.
- `AppModeSelector` (`src/components/AppModeSelector.tsx`) handles framework switching.

## 4. Existing APIs
- `/api/ai/generate`: AI agent generation logic.
- `/api/preview/*`: Docker/Runtime lifecycle endpoints.
- `/api/hub/*`: External hub APIs.
- `/api/runtime/*`: Runtime execution endpoints.
- **Rules:** DO NOT modify APIs unless explicitly required for a new UI feature. They are stable.

## 5. Files Safe to Edit (Wrappers / Extensions)
- **New Files to Create:** `BuilderWorkspaceShell.tsx`, `BuilderTopBar.tsx`, `EnvironmentPanel.tsx`, `DeploymentPanel.tsx`, `ProjectSidebar.tsx`.
- `src/components/BuilderLayout.tsx` (Safe to modify ONLY to replace internal panels or wrap the layout, but state must be preserved).

## 6. Files Unsafe to Edit
- `src/lib/agents/orchestrator.ts` (Core AI logic).
- `src/lib/memory/versionManager.ts` & `projectMemory.ts` (Core memory tracking).
- API Routes in `src/app/api/...`
- Core preview components in `src/components/preview/...`

## 7. Rollback Plan
- **Pre-Execution:** Git is theoretically tracking this workspace, but locally the VersionManager holds snapshots.
- If UI breaks: Revert `src/components/BuilderLayout.tsx` to the previous stable state where panels were dynamically rendered via a simple ternary tree. Delete any newly created wrapper shells.
- All new files will be isolated components, ensuring minimal collateral damage.

## Next Steps
1. Create `BuilderWorkspaceShell.tsx` to act as the primary wrapper.
2. Build `BuilderTopBar.tsx` and `ProjectSidebar.tsx`.
3. Add `EnvironmentPanel.tsx` and `DeploymentPanel.tsx`.
4. Wrap existing `BuilderLayout` inside the shell.

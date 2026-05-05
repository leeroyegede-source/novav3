# Storage Upgrade Audit

## LocalStorage Keys Used
- `nova_files`: Stores full project files (RISKY: Must migrate to IndexedDB).
- `nova_versions`: Stores full version snapshots and memory (RISKY: Must migrate to IndexedDB).
- `nova_messages`: Stores the chat UI message list (RISKY: Must migrate to IndexedDB).
- `nova_history`: Stores the strict history prompt for Claude (RISKY: Must migrate to IndexedDB).
- `nova_project_memory`: Stores the Code Memory database (RISKY: Must migrate to IndexedDB).
- `nova_recent_projects`: Stores recent projects. Currently stores metadata, which is relatively safe, but should be managed carefully.
- `nova_appMode`: Stores the selected app mode (SAFE: UI Preference).

## Save & Load Logic
- **Current Save Function (`handleSave` in `BuilderLayout.tsx`)**:
  - Sets `nova_appMode` and `nova_files` in localStorage.
  - Updates `nova_recent_projects` with project metadata and a timestamp.
- **Current Load Function (`useEffect` in `BuilderLayout.tsx`)**:
  - Checks for `nova_files` and `nova_appMode` in localStorage.
  - If present, sets them into state.
- **Current Recent Projects Logic**:
  - Reads `nova_recent_projects` to populate dropdown.
  
## Current Runner Hydration Flow
- Project files are loaded into React state (`files`).
- When the preview panel is open, `PreviewPanel.tsx` hits `/api/preview/start` and passes the `files` state payload.
- The backend writes files to the Docker/Local runner workspace and starts it.

## File Categorization
### Risky Files to Avoid
- `src/lib/agents/orchestrator.ts` (API interaction, keep clean)
- `src/app/api/preview/start/route.ts` (Runner initialization, don't break)
- `src/app/api/runtime/boot/route.ts` (Runtime shell logic)

### Safe Files to Edit
- `src/components/BuilderLayout.tsx` (Save/Load/Hydration logic)
- `src/components/chat/ChatPanel.tsx` (Chat storage)
- `src/lib/memory/versionManager.ts` (Version storage logic)
- `src/lib/memory/projectMemory.ts` (Memory storage logic)
- `src/lib/storage/indexedDB.ts` (To be created)

# Save System Audit

## Save Button Component
The save button is a button with a `Save` icon located inside the `BuilderLayout.tsx` top toolbar area (specifically the actions toolbar rendered conditionally or on desktop). 
It calls the `handleSave` function.

## Save Handler Function
The `handleSave` function is defined in `src/components/BuilderLayout.tsx` lines 125-150.

## Current Storage Method
1. `VersionManager.saveSnapshot(files, 'Manual Save')` - Uses `LocalDB.set` (IndexedDB) and `localStorage`.
2. `localStorage.setItem('nova_appMode', appMode)` - Stores current mode.
3. `localStorage.setItem('nova_files', JSON.stringify(files))` - Stores stringified project files.
4. `LocalDB.set(STORE_FILES, 'nova_active_files', files)` - Stores actual file map to IndexedDB.
5. Updates `localStorage.getItem('nova_recent_projects')` array with `{id, name, mode, time}`.

## Current Recent Projects Logic
Lives in `BuilderTopBar.tsx`. Reads `nova_recent_projects` from `localStorage`.
When a user clicks a project, it triggers `handleLoadProject(p.id)`.

## Current Project Load Logic
When the builder loads (in `BuilderLayout.tsx` `useEffect` on line 181), it:
1. Calls `VersionManager.init()` and `ProjectMemory.init()`.
2. Attempts to load `nova_active_files` from `LocalDB` (IndexedDB).
3. If not in `LocalDB`, falls back to parsing `localStorage.getItem('nova_files')`.
4. Restores `appMode` from `localStorage.getItem('nova_appMode')`.
5. Sets `isHydrated` to true, and sets `files` and `appMode`.

Wait, what about loading a specific project from Recent dropdown?
In `BuilderTopBar.tsx`, `handleLoadProject(p.id)` currently just says:
```ts
const handleLoadProject = (projId: string) => {
  alert('Project loaded: ' + projId);
  setRecentOpen(false);
};
```
Ah! It doesn't actually load a full project other than the one active workspace. We need to implement proper multiple project loading logic!

## Current Version System Interaction
`VersionManager.saveSnapshot` takes `files` and saves it. 

## Runner Hydration Process
The runner relies entirely on the `files` object state variable. When `files` changes, `BuilderLayout` re-renders and auto-syncs. The actual runner is triggered by the `PreviewPanel` or `Deploy` action sending `files` via a POST to `/api/preview/start`.

## File State Structure
`Record<string, string>` where keys are relative paths like `/App.js`, `/package.json` and values are string contents.

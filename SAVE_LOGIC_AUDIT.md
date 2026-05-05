# SAVE LOGIC AUDIT

## 1. Where the Save button is rendered
The Save button is rendered in the top-right toolbar of the builder (`BuilderLayout.tsx`, line ~669) within the `<div className="flex items-center gap-2 ml-auto">` container alongside the New Project, Clear Workspace, and Download ZIP buttons. It uses the `Save` icon from `lucide-react`.

## 2. Which function runs when Save is clicked
Clicking the Save button runs the `handleSave()` function defined in `BuilderLayout.tsx`.

## 3. Where projects are currently saved
Projects are actively stored in two places:
1. **IndexedDB (`nova-store`)**: The full, heavy file tree (`Record<string, string>`) is stored using the `LocalDB` utility inside the `project_files` store, keyed by the `project_id`.
2. **localStorage (`nova_recent_projects`)**: A lightweight array of metadata `{ id, name, mode, time, source }` is stored here to render the Recent dropdown menus without lagging the browser.

## 4. Whether save uses localStorage, IndexedDB, Supabase, or another storage
It uses a combination of **IndexedDB** (for durable, large file persistence) and **localStorage** (for fast UI metadata and active session recovery). No backend storage like Supabase is currently used for the raw project files.

## 5. What keys/tables/storage paths are used
- **IndexedDB**: 
  - Store: `project_files` -> Key: `[project_id]` (Contains full project code).
  - Store: `project_files` -> Key: `nova_active_files` (Contains currently open workspace).
- **localStorage**:
  - `nova_recent_projects` -> Array of project metadata.
  - `nova_appMode` -> Current framework mode string.
  - `nova_files` -> Stringified fallback payload of active files.
  - `nova_project_memory` -> Chat and context history state.

## 6. How Recent projects are updated
When `handleSave()` is called, it queries `ProjectMemory.getMemory()` to extract the `project_id` and `project_name`. It then searches the `nova_recent_projects` array in `localStorage`. If the ID exists, it updates the timestamp; if not, it unshifts the new metadata object to the front of the array. The `BuilderTopBar` automatically detects this via the `nova-recent-updated` event.

## 7. How saved projects are loaded/opened again
When a project is clicked in the Recent list, `onLoadProject(projId)` fires. This runs the `loadProject` function inside `BuilderLayout.tsx`, which queries IndexedDB (`LocalDB.get(STORE_FILES, projId)`). If found, it instantly re-hydrates `files`, `appMode`, and syncs the `ProjectMemory` context back to that specific project ID, triggering the runner to reboot seamlessly.

## 8. Whether full project files are being stored in browser memory
**Yes.** All code files are durably retained inside the browser via IndexedDB (which comfortably handles gigabytes of data and prevents `localStorage` quota crashes).

## 9. Why the new save upgrade is not working
**The Root Bug:** The project ID generator is completely broken when creating new projects. 
When you click "New Project", the code runs `localStorage.removeItem('nova_project_memory')`, but it completely fails to wipe the **in-memory cache** of the `ProjectMemory` class. 
When the system immediately calls `ProjectMemory.getMemory()` to configure the new project, it retrieves the *stale memory state* belonging to the previous project (including the old `project_id`). 
Because of this, **every single project you create ends up sharing the exact same `project_id`**. When you save, it blindly overwrites the previous project in IndexedDB rather than creating a distinct new one.

## 10. What exact files need to be changed to fix it safely
To fix this non-destructively:
1. **`src/lib/memory/projectMemory.ts`**: Needs a `clearMemory()` static method that forces the internal `this.state` to null and generates a fresh, unique `project_id`.
2. **`src/components/BuilderLayout.tsx`**: The `handleNewProject` function must call `ProjectMemory.clearMemory()` instead of just `localStorage.removeItem(...)` to ensure a completely clean slate with a brand new, unique ID before saving.

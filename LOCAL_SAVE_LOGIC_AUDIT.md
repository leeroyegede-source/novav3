# LOCAL SAVE LOGIC AUDIT

## 1. Where the Save button is rendered
The Save button is rendered in the top-right toolbar of the builder layout (specifically within `BuilderLayout.tsx` around line 783 as `<button onClick={() => handleSave()} title="Save Project">`).

## 2. Which function runs when Save is clicked
The `handleSave` function inside `src/components/BuilderLayout.tsx`.

## 3. Where project files are currently saved
Currently, files are saved to **both** local storage mechanisms (IndexedDB + localStorage) and a cloud database (Supabase), depending on whether the user is logged in.

## 4. Storage Usage Breakdown
- **localStorage:** Used for lightweight UI metadata (`nova_recent_projects`, `nova_appMode`, and active workspace string fallback `nova_files`).
- **IndexedDB:** Primary robust storage for active workspaces (`nova_active_files`), named project files (indexed by `project_id`), and version histories.
- **Supabase:** Cloud storage. If a user session exists, `handleSave` pushes data to tables: `projects`, `project_files`, and `project_memory`.

## 5. Where Recent projects are stored
Stored exclusively in **localStorage** under the key `nova_recent_projects` as a JSON array of metadata objects.

## 6. How Recent projects are loaded
When rendering the Start Screen or clicking the "Recent" dropdown, the system runs `JSON.parse(localStorage.getItem('nova_recent_projects'))` to generate the list of clickable project buttons. When clicked, `loadProject(projId)` is called.

## 7. How Delete currently works
The `deleteProject(projId)` function inside `BuilderLayout.tsx`:
1. Blocks deletion if `projId` is currently open.
2. Checks the project's metadata `source` attribute from `nova_recent_projects`.
3. If `source === 'supabase'`, it issues a delete to Supabase.
4. If `source === 'indexeddb'` or `local`, it removes it from IndexedDB.
5. It filters the project out of `nova_recent_projects` and triggers a UI update event.

## 8. Whether Delete tries Supabase
**Yes.** If the `source` is tagged as `supabase` or `unknown`, the function attempts `await supabase.from('projects').delete().eq('id', projId);`.

## 9. Where Supabase project save/delete logic exists
It is hardcoded directly inside `src/components/BuilderLayout.tsx` within the `handleSave`, `loadProject`, and `deleteProject` functions.

## 10. Where IndexedDB save/load logic exists
IndexedDB is used heavily in `BuilderLayout.tsx` (via `LocalDB.set` and `LocalDB.get`), as well as `src/lib/memory/versionManager.ts` (for project-scoped version timelines) and `src/lib/memory/projectMemory.ts`.

## 11. Where localStorage save/load logic exists
Also natively spread across `BuilderLayout.tsx` (for immediate synchronous state hydration) and the memory class managers.

## 12. Storage Keys in Use
- **`nova_files`**: localStorage fallback of the active workspace file tree string.
- **`nova_active_files`**: IndexedDB storage of the active workspace.
- **`nova_recent_projects`**: localStorage array storing metadata `{id, name, mode, time, source}`.
- **`nova_project_memory`**: localStorage object caching active memory summary and `project_id`.
- **`nova_appMode`**: localStorage string of the detected active mode (e.g., "Next.js / SSR").
- **`nova_versions_{project_id}`**: IndexedDB key for a specific project's version snapshots.

## 13. How project_id is generated
Inside `ProjectMemory.clearMemory()`, it generates a unique cryptographic-like string:
`'proj_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36)`

## 14. How new projects are separated from old projects
By invoking `ProjectMemory.clearMemory()` and `VersionManager.clearHistory()`. This generates a clean `project_id`, causing all subsequent IndexedDB file saves and version snapshots to be scoped to the new ID, preventing overlap.

## 15. How versions are saved
`VersionManager.saveSnapshot` pushes the state into an array and commits it to both localStorage and IndexedDB using the project-scoped key `nova_versions_{project_id}`.

## 16. How imported/uploaded projects are saved
During ZIP/Folder import, a new `project_id` is created. Files are parsed, and `handleSave()` is immediately executed to store them natively under the new `project_id` in IndexedDB.

## 17. How runner hydration works after loading a project
`loadProject` fetches files from IndexedDB and updates the React `files` state. The UI re-renders, but the runner/Docker container remains idle until the user manually triggers a deploy/preview via the Preview panel (which sends the files payload to `/api/preview/start`).

## 18. What exact files need to be changed to make saving LOCAL-ONLY safely
To completely decouple Supabase and make the builder local-only, ONLY **`src/components/BuilderLayout.tsx`** needs to be modified.

### Safest Plan to Convert to LOCAL-ONLY Save:
1. **Refactor `handleSave`**: Strip out all `supabase.auth.getSession()` checks and `supabase.from()` calls. Hardcode `source = 'indexeddb'` and write exclusively to `LocalDB`.
2. **Refactor `loadProject`**: Remove the `source === 'supabase'` conditional branch entirely. Only fetch via `LocalDB.get(STORE_FILES, projId)`.
3. **Refactor `deleteProject`**: Remove the Supabase deletion branch. Always run `LocalDB.remove(STORE_FILES, projId)`.
4. Ensure we do NOT delete the `supabaseClient.ts` import if it's used elsewhere (e.g., auth bar), but we remove its usage from the save/load lifecycle.

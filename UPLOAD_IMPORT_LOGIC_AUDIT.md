# UPLOAD & IMPORT LOGIC AUDIT

## 1. Where the Upload button is rendered
Upload mechanisms are rendered in two places in `BuilderLayout.tsx`:
1. **The Start Screen:** Contains an "Import Folder" `<label>` button.
2. **The Workspace Toolbar (Top Right):** Contains icons for "Import from GitHub", "Upload ZIP" (`<input type="file" accept=".zip">`), and "Upload Folder" (`<input type="file" webkitdirectory="true">`).

## 2. Which function runs when Upload is clicked
- **Folder Upload:** Triggers `handleFolderUpload(e)`.
- **ZIP Upload:** Triggers `handleZipUpload(e)`.
- **GitHub Import:** Triggers `handleGithubImport()`.

## 3. What file types are currently accepted
The system natively accepts `.zip` archives and raw system Folders. During traversal, it accepts all text-readable file types, but intentionally skips `node_modules`, `.git`, and `.next` to prevent crashing the browser. It also strips out relative traversal paths (`..`) for security.

## 4. Whether ZIP extraction already exists
**Yes.** The system uses the `JSZip` library to run client-side ZIP parsing and extraction directly within browser memory (`processZipData` function). 

## 5. Where uploaded files are stored
Immediately after extraction, they are placed directly into the React runtime memory via the `setFiles(newFiles)` state. They are also loosely cached into `nova_active_files` (IndexedDB) as an anonymous workspace. **They are NOT stored as an official saved project.**

## 6. How uploaded files are converted into the builder file tree
The extraction functions iterate through the file paths, strip off the top-level root directory name to flatten the structure, read the raw string contents, and pack them into a flat `Record<string, string>` object map that the `FileExplorer` uses to render the tree.

## 7. How app mode is detected after upload
The system runs `autoDetectAndSetMode(newFiles)`.
- It scans the file tree for `next.config.js`, `layout.tsx`, or `_app.js`. If found → Sets mode to **Next.js / SSR**.
- Else, it checks `package.json` for `"react"`. If found → Sets mode to **React / Vite**.
- Else → Defaults to **Static Website**.

## 8. How uploaded projects are sent to the local runner
The uploaded project is NOT automatically sent. It sits in the builder's state until the user clicks the "Start App / Deploy" button in the Preview panel. This action bundles the `files` object and POSTs it to the `/api/preview/start` endpoint for execution.

## 9. How preview starts after upload
Preview remains dormant until manually booted by the user via the Preview panel's interface.

## 10. How uploaded projects are saved
**They are not saved automatically.** If the user hits the Save button, the uploaded files will be blindly saved under whatever `project_id` happens to currently exist in `ProjectMemory`. 

## 11. How uploaded projects appear in Recent
Because they are not automatically assigned an ID and saved upon upload, **they do not appear in the Recent list at all** until manually saved. If saved without generating a new ID, they simply overwrite the last active project in the Recent list.

## 12. What breaks or is missing for importing existing projects from other AI builders
**The Core Disconnect:** 
When a ZIP or Folder is uploaded, the builder treats it simply as a "file payload replacement" for the *current* workspace. 
It does **NOT**:
- Generate a new, unique `project_id`.
- Clear out the previous project's `VersionHistory`.
- Prompt the user to give the imported project a Name.
- Officially register the project into the Database/Recent List.

Because of this, importing a codebase from v0, Lovable, or Bolt will "infect" and overwrite your currently open project's memory space and version history.

## 13. What exact files need to be changed to support full project import safely
To fix this flawlessly, ONLY **`src/components/BuilderLayout.tsx`** needs to be modified.

**Safe Fix Recommendation:**
The `handleZipUpload`, `handleFolderUpload`, and `handleGithubImport` functions must be updated to mirror the `createNewProject` flow:
1. Prompt the user for a Project Name (or extract the folder name natively).
2. Call `ProjectMemory.clearMemory()` to guarantee a brand-new ID.
3. Call `VersionManager.clearHistory()` to reset the version timeline.
4. Run the file extraction and Mode Detection.
5. Immediately invoke `handleSave(newFiles, projectName, detectedMode)` so the imported codebase is instantly serialized into IndexedDB and registered in the Recent dropdown.

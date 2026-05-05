# NovaAI App Builder - System Audit (Stage 1)

## Overview
NovaAI is a production-grade application builder operating on a Next.js (App Router) architecture with a hybrid local runner engine. It supports autonomous codebase generation, zero-click local container execution, and deployment orchestration.

## 1. Routes
- **`/` (Root)**: The main entry point loading the builder dashboard.
- **`/admin`**: Administrative dashboard interface.
- **`/hub`**: Component and integration hub routing.
- **`/api/ai`**: Handles AI code generation (vision support, chat history, Claude orchestration).
- **`/api/preview`**: Manages the local container lifecycle (start, stop, restart, logs).
- **`/api/runtime`**: Handles execution APIs for the local environment.
- **`/api/deploy`**: Orchestrates external deployments (e.g., Vercel).
- **`/api/save-local`**: Manages codebase ejection/download mechanisms.

## 2. API Endpoints (Core)
- `POST /api/ai/generate`: The primary brain. Accepts prompt, files, images, and history. Routes to the orchestrator to fetch code modifications.
- `POST /api/preview/start`: Instantiates the `LocalRunner`, assigns available ports, maps directories, and spawns the container.
- `GET /api/preview/logs`: Streams real-time stdout/stderr from the active container.
- `POST /api/preview/stop`: Kills running local process trees securely via PID mapping.

## 3. Database Usage
- **Provider**: Supabase.
- **Location**: `src/lib/supabase/client.ts`.
- **Usage**: Handles authentication and telemetry/metadata persistence for users. The DB is heavily abstracted in the builder to allow for "Bring Your Own Database" configurations natively inside the generated workspaces.

## 4. Auth System
- Handled natively via Supabase client architecture.
- Session persistence logic implemented in `/admin` and `/hub` middleware routes.

## 5. Builder Logic
- **`BuilderLayout.tsx`**: The god-component orchestrating the UI. Maintains virtual workspace states (`files` object).
- **`ChatPanel.tsx`**: Receives user intent, manages Time-Travel debugger, sends data to `/api/ai/generate`.
- **`FileExplorer.tsx`**: Virtual file system viewer for generated components.
- **`CodeEditor.tsx`**: Editor instance for direct code modifications.
- **`ArchitectureCanvas.tsx`**: Node-based visual architect planner (React Flow based).
- **Orchestrator (`lib/agents/orchestrator.ts`)**: Routes user prompts to specialized Agents (Builder, Debugger, API, Database). Integrates a self-healing QA debate pipeline.

## 6. Preview System
- **`PreviewPanel.tsx`**: Consumes `containerInfo` and renders an iframe pointing to `localhost:<port>`. It also features a real-time console overlay capturing terminal stdout.
- **`LocalRunner.ts`**: The engine behind the scenes. Spawns and manages sub-processes for Next.js, Vite, Node, PHP, Laravel, and Static HTML. It implements Docker integration for complex backend runtimes (e.g., PHP/Laravel).

## 7. Tool Integrations
- **Anthropic AI (Claude)**: The core code-generation model.
- **Docker**: Used seamlessly via the LocalRunner for PHP/Composer isolation.
- **JSZip / FileSaver**: For ejection of the codebase locally (`handleDownloadZip`).
- **Time-Travel History**: A slider that allows the user to restore previous states of the workspace structure.

## Summary & Next Steps
The builder demonstrates robust handling of isolated application states. The Stage 1 Audit proves the project compiles properly and routes are fully accessible.
Ready to proceed with **Stage 2: Version Manager Integration** to fortify the local memory/snapshot timeline logic.

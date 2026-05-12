// test-tools.ts
import { ToolRegistry } from './src/lib/tools/ToolRegistry';
import { supabaseAuthTool } from './src/lib/tools/plugins/AuthTool';
import { apiBuilderTool, uiDesignTool } from './src/lib/tools/plugins/OtherTools';

console.log("=== Testing 3 Tools Live ===");

let workspaceFiles: Record<string, string> = {
  "/package.json": "{ \"name\": \"test\" }",
  "/src/index.ts": "console.log('hello');"
};

const mode = "nextjs-app-router";

console.log("Initial Workspace has", Object.keys(workspaceFiles).length, "files.");

console.log("\n1. Testing Supabase Auth Tool...");
ToolRegistry.register(supabaseAuthTool);
try {
  workspaceFiles = ToolRegistry.safeInject(supabaseAuthTool.id, workspaceFiles, mode);
  console.log("✅ Supabase Auth Injected Successfully!");
  console.log("Added files:");
  console.log(Object.keys(workspaceFiles).filter(f => f !== "/package.json" && f !== "/src/index.ts"));
} catch(e: any) {
  console.log("❌ Error:", e.message);
}

console.log("\n2. Testing API Builder Tool...");
ToolRegistry.register(apiBuilderTool);
try {
  workspaceFiles = ToolRegistry.safeInject(apiBuilderTool.id, workspaceFiles, mode);
  console.log("✅ API Builder Injected Successfully!");
  console.log("New file created:", !!workspaceFiles["/src/api/routes.ts"]);
} catch(e: any) {
  console.log("❌ Error:", e.message);
}

console.log("\n3. Testing UI Design Tool...");
ToolRegistry.register(uiDesignTool);
try {
  workspaceFiles = ToolRegistry.safeInject(uiDesignTool.id, workspaceFiles, mode);
  console.log("✅ UI Design Injected Successfully!");
  console.log("New file created:", !!workspaceFiles["/src/components/ui/Button.tsx"]);
} catch(e: any) {
  console.log("❌ Error:", e.message);
}

console.log("\n=== Test Complete ===");
console.log("Total files in workspace now:", Object.keys(workspaceFiles).length);

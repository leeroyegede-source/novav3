import { ToolRegistry, ToolPlugin } from '../ToolRegistry';

const createMetadataTool = (
  id: string,
  name: string,
  category: string,
  description: string,
  supportedModes: string[],
  incompatibleModes: string[] = ['static']
): ToolPlugin => ({
  id,
  name,
  description,
  category,
  supportedModes,
  incompatibleModes,
  requiredPackages: [],
  requiredEnvVars: [],
  filesToCreate: [],
  filesToModify: [],
  adapterStrategy: "Placeholder metadata - No code injected automatically.",
  installSteps: ["Approve injection", "Run migration"],
  testSteps: ["Verify tool UI", "Run tests"],
  rollbackSteps: ["Restore snapshot"],
  isInstalled: (files) => false,
  inject: (files, currentMode) => {
    // DO NOT modify project files. ONLY register tool metadata.
    // Tools must only be injected when user clicks "Install", but for now this is a safe placeholder.
    return { ...files };
  }
});

const expandedTools = [
  createMetadataTool("hubaddress-engine", "HubAddress Address Engine", "HubAddress Core", "Address model, address code/unique ID, house/business profile, searchable fields, verification status.", ["nextjs-app-router", "react-vite", "node-express", "php-native", "laravel"]),
  createMetadataTool("address-verification", "Address Verification Tool", "HubAddress Core", "Pending/verified/rejected statuses, admin approval flow, document proof hook.", ["nextjs-app-router", "react-vite", "node-express", "laravel"], ["static", "php-native"]),
  createMetadataTool("public-directory", "Public Directory / Listing Tool", "HubAddress Core", "Public listing pages, detail page, directory UI structure, privacy controls.", ["nextjs-app-router", "react-vite", "node-express"], ["static", "php-native", "laravel"]),
  createMetadataTool("geolocation-map", "Geolocation + Map Tool", "HubAddress Core", "Lat/lng fields, map adapter placeholder, nearby search structure.", ["nextjs-app-router", "react-vite"], ["static", "node-express", "php-native", "laravel"]),
  createMetadataTool("advanced-search", "Advanced Search + Filter Tool", "HubAddress Core", "Search API structure, filters, sorting, pagination.", ["nextjs-app-router", "react-vite", "node-express"], ["static", "php-native", "laravel"]),
  
  createMetadataTool("multi-tenant-workspace", "Multi-Tenant Workspace Tool", "SaaS Core", "Organizations/workspaces, user membership, tenant_id pattern, Supabase RLS guidance.", ["nextjs-app-router", "node-express", "laravel"], ["static", "php-native", "react-vite"]),
  createMetadataTool("role-permission", "Role + Permission Matrix Tool", "SaaS Core", "Admin/user/editor roles, API guards, route guards.", ["nextjs-app-router", "node-express", "laravel"], ["static", "php-native", "react-vite"]),
  createMetadataTool("admin-operations", "Admin Operations Tool", "SaaS Core", "Manage users, records, verification approval, admin panel logic.", ["nextjs-app-router", "react-vite", "node-express"], ["static", "php-native", "laravel"]),
  createMetadataTool("audit-log", "Audit Log Tool", "SaaS Core", "Track actions, timestamp, change logs.", ["nextjs-app-router", "node-express", "laravel"], ["static", "php-native", "react-vite"]),
  createMetadataTool("usage-limit-quota", "Usage Limit + Quota Tool", "SaaS Core", "Limits per user, usage counters, plan limits.", ["nextjs-app-router", "node-express"], ["static", "php-native", "laravel", "react-vite"]),
  createMetadataTool("subscription-structure", "Subscription Structure Tool", "SaaS Core", "Plan model, subscription status, billing-ready structure only.", ["nextjs-app-router", "node-express"], ["static", "php-native", "laravel", "react-vite"]),
  
  createMetadataTool("file-document-storage", "File / Document Storage Tool", "Data / Storage", "Supabase storage adapter, file metadata, upload UI, private/public access.", ["nextjs-app-router", "node-express", "laravel"], ["static", "php-native", "react-vite"]),
  
  createMetadataTool("ai-req-analyzer", "AI Requirements Analyzer", "AI Intelligence", "Convert prompt to requirements, detect pages/APIs/DB/tools.", ["nextjs-app-router", "react-vite", "node-express", "php-native", "laravel", "static"], []),
  createMetadataTool("ai-task-planner", "AI Task Planner", "AI Intelligence", "Break large builds into steps, prevent output overflow.", ["nextjs-app-router", "react-vite", "node-express", "php-native", "laravel", "static"], []),
  createMetadataTool("ai-tool-orchestrator", "AI Tool Orchestrator", "AI Intelligence", "Decide which tools to use, avoid conflicts.", ["nextjs-app-router", "react-vite", "node-express", "php-native", "laravel", "static"], []),
  
  createMetadataTool("health-score", "Project Health Score Tool", "Quality / Production", "Build status, preview status, env check, security check.", ["nextjs-app-router", "react-vite", "node-express", "php-native", "laravel", "static"], []),
  createMetadataTool("mobile-audit", "Mobile Responsiveness Audit Tool", "Quality / Production", "Detect layout issues, support preview modes.", ["nextjs-app-router", "react-vite"], ["node-express", "php-native", "laravel", "static"]),
  createMetadataTool("release-checklist", "Release Checklist Tool", "Quality / Production", "Env/auth/db/test checks before production release.", ["nextjs-app-router", "react-vite", "node-express", "php-native", "laravel", "static"], []),
  createMetadataTool("backup-restore", "Backup / Restore Tool", "Quality / Production", "Export data, restore data safely.", ["node-express", "laravel"], ["nextjs-app-router", "react-vite", "php-native", "static"]),
  createMetadataTool("tool-compatibility", "Tool Compatibility + Conflict Checker", "Quality / Production", "Prevent duplicate tools, detect conflicts before install.", ["nextjs-app-router", "react-vite", "node-express", "php-native", "laravel", "static"], []),
  
  createMetadataTool("advanced-api-generator", "Advanced API Generator Tool", "Backend / API", "Standardized API structure, validation, pagination, filtering, sorting, rate limit structure, auth guards.", ["nextjs-app-router", "node-express"], ["react-vite", "php-native", "laravel", "static"]),
  createMetadataTool("api-tester", "API Tester Tool", "Testing / Debugging", "API request UI, response viewer, quick test buttons, history of API calls.", ["nextjs-app-router", "react-vite", "node-express", "php-native", "laravel", "static"], []),
  createMetadataTool("e2e-validation", "E2E + Validation Test Tool", "Testing / QA", "Route testing, form submission testing, API response validation, basic user flow testing.", ["nextjs-app-router", "react-vite", "node-express", "php-native", "laravel", "static"], []),
];

expandedTools.forEach(tool => ToolRegistry.register(tool));

import { ToolPlugin, ToolRegistry } from '../ToolRegistry';

export const apiBuilderTool: ToolPlugin = {
  id: 'api-builder',
  name: 'API Builder Tool',
  description: 'Generate REST endpoints, validation logic, and error handling.',
  category: 'Backend',
  supportedModes: ['nextjs-app-router', 'node-express', 'laravel', 'php-native'],
  incompatibleModes: ['react-vite', 'static'],
  requiredPackages: [],
  requiredEnvVars: [],
  filesToCreate: ['/src/api/routes.ts'],
  filesToModify: [],
  adapterStrategy: 'Mode-specific route generation',
  installSteps: ['Scaffold API directory'],
  testSteps: ['Verify endpoints'],
  rollbackSteps: ['Remove API directory'],
  isInstalled: (files) => !!files['/src/api/routes.ts'],
  inject: (files, mode) => {
    const newFiles = { ...files };
    newFiles['/src/api/routes.ts'] = `// API Routes Scaffolding`;
    return newFiles;
  }
};

export const genericDatabaseTool: ToolPlugin = {
  id: 'db-generic',
  name: 'Database Helpers',
  description: 'Schema helpers, migration templates, seed templates, DB health check.',
  category: 'Database',
  supportedModes: ['nextjs-app-router', 'node-express', 'laravel', 'php-native'],
  incompatibleModes: ['react-vite', 'static'],
  requiredPackages: [],
  requiredEnvVars: ['DB_HOST', 'DB_USER', 'DB_PASS'],
  filesToCreate: ['/src/db/helpers.ts'],
  filesToModify: [],
  adapterStrategy: 'Native SQL helpers',
  installSteps: ['Create helpers'],
  testSteps: ['Health check'],
  rollbackSteps: ['Remove helpers'],
  isInstalled: (files) => !!files['/src/db/helpers.ts'],
  inject: (files) => {
    const newFiles = { ...files };
    newFiles['/src/db/helpers.ts'] = `// DB Helpers`;
    return newFiles;
  }
};

export const uiDesignTool: ToolPlugin = {
  id: 'ui-design',
  name: 'UI / Design System',
  description: 'Tailwind components, responsive layouts, theme support.',
  category: 'Frontend',
  supportedModes: ['nextjs-app-router', 'react-vite', 'laravel', 'php-native', 'static'],
  incompatibleModes: [],
  requiredPackages: ['tailwindcss@latest'],
  requiredEnvVars: [],
  filesToCreate: ['/src/components/ui/Button.tsx'],
  filesToModify: ['/tailwind.config.js'],
  adapterStrategy: 'CSS utility injection',
  installSteps: ['Add UI blocks'],
  testSteps: ['Compile CSS'],
  rollbackSteps: ['Remove UI blocks'],
  isInstalled: (files) => !!files['/src/components/ui/Button.tsx'],
  inject: (files) => {
    const newFiles = { ...files };
    newFiles['/src/components/ui/Button.tsx'] = `// Generic Button component`;
    return newFiles;
  }
};

export const emailTool: ToolPlugin = {
  id: 'email-tool',
  name: 'Email Service',
  description: 'Backend email endpoint and provider adapter.',
  category: 'Communication',
  supportedModes: ['nextjs-app-router', 'node-express', 'laravel', 'php-native'],
  incompatibleModes: ['react-vite', 'static'],
  requiredPackages: ['nodemailer@latest'],
  requiredEnvVars: ['EMAIL_PROVIDER_API_KEY'],
  filesToCreate: ['/src/services/email.ts'],
  filesToModify: [],
  adapterStrategy: 'SMTP / API abstraction',
  installSteps: ['Setup email service'],
  testSteps: ['Send test email'],
  rollbackSteps: ['Remove email service'],
  isInstalled: (files) => !!files['/src/services/email.ts'],
  inject: (files) => {
    const newFiles = { ...files };
    newFiles['/src/services/email.ts'] = `// Email Service`;
    return newFiles;
  }
};

export const ocrTool: ToolPlugin = {
  id: 'ocr-tool',
  name: 'OCR / File Reader',
  description: 'File upload support and text extraction.',
  category: 'Utilities',
  supportedModes: ['nextjs-app-router', 'react-vite', 'node-express', 'laravel'],
  incompatibleModes: [],
  requiredPackages: ['tesseract.js@latest'],
  requiredEnvVars: [],
  filesToCreate: ['/src/utils/ocr.ts'],
  filesToModify: [],
  adapterStrategy: 'WASM extraction',
  installSteps: ['Add OCR helper'],
  testSteps: ['Test extraction'],
  rollbackSteps: ['Remove OCR helper'],
  isInstalled: (files) => !!files['/src/utils/ocr.ts'],
  inject: (files) => {
    const newFiles = { ...files };
    newFiles['/src/utils/ocr.ts'] = `// OCR Helper`;
    return newFiles;
  }
};

export const aiChatTool: ToolPlugin = {
  id: 'ai-chat',
  name: 'AI Chat',
  description: 'Backend-safe chat endpoint and UI component.',
  category: 'AI',
  supportedModes: ['nextjs-app-router', 'react-vite', 'node-express'],
  incompatibleModes: ['php-native', 'static'],
  requiredPackages: ['openai@latest'],
  requiredEnvVars: ['OPENAI_API_KEY'],
  filesToCreate: ['/src/components/Chat.tsx'],
  filesToModify: [],
  adapterStrategy: 'LLM streaming abstraction',
  installSteps: ['Add Chat UI', 'Add AI Route'],
  testSteps: ['Test chat generation'],
  rollbackSteps: ['Remove Chat UI'],
  isInstalled: (files) => !!files['/src/components/Chat.tsx'],
  inject: (files) => {
    const newFiles = { ...files };
    newFiles['/src/components/Chat.tsx'] = `// Chat UI Component`;
    return newFiles;
  }
};

export const crudGeneratorTool: ToolPlugin = {
  id: 'crud-gen',
  name: 'CRUD Generator',
  description: 'Generate CRUD pages, controllers, and connect to DB.',
  category: 'Backend',
  supportedModes: ['nextjs-app-router', 'node-express', 'laravel', 'php-native'],
  incompatibleModes: ['react-vite', 'static'],
  requiredPackages: [],
  requiredEnvVars: [],
  filesToCreate: ['/src/api/crudHandler.ts'],
  filesToModify: [],
  adapterStrategy: 'Dynamic routing mapping',
  installSteps: ['Add CRUD handler'],
  testSteps: ['Test CRUD ops'],
  rollbackSteps: ['Remove CRUD handler'],
  isInstalled: (files) => !!files['/src/api/crudHandler.ts'],
  inject: (files) => {
    const newFiles = { ...files };
    newFiles['/src/api/crudHandler.ts'] = `// Generic CRUD Handler`;
    return newFiles;
  }
};

export const analyticsTool: ToolPlugin = {
  id: 'analytics',
  name: 'Analytics Tracker',
  description: 'Event tracking structure and page view tracking.',
  category: 'Utilities',
  supportedModes: ['nextjs-app-router', 'react-vite', 'laravel', 'php-native', 'static'],
  incompatibleModes: [],
  requiredPackages: [],
  requiredEnvVars: ['ANALYTICS_KEY'],
  filesToCreate: ['/src/utils/analytics.ts'],
  filesToModify: [],
  adapterStrategy: 'Client-side event listener',
  installSteps: ['Add analytics tracker'],
  testSteps: ['Verify beacon'],
  rollbackSteps: ['Remove tracker'],
  isInstalled: (files) => !!files['/src/utils/analytics.ts'],
  inject: (files) => {
    const newFiles = { ...files };
    newFiles['/src/utils/analytics.ts'] = `// Analytics Provider`;
    return newFiles;
  }
};

export const notificationTool: ToolPlugin = {
  id: 'notifications',
  name: 'Notification System',
  description: 'In-app notifications and optional email integration.',
  category: 'Communication',
  supportedModes: ['nextjs-app-router', 'react-vite'],
  incompatibleModes: ['static'],
  requiredPackages: ['react-hot-toast@latest'],
  requiredEnvVars: [],
  filesToCreate: ['/src/components/Notifications.tsx'],
  filesToModify: [],
  adapterStrategy: 'Context provider injection',
  installSteps: ['Add Notification context'],
  testSteps: ['Trigger toast'],
  rollbackSteps: ['Remove Notification context'],
  isInstalled: (files) => !!files['/src/components/Notifications.tsx'],
  inject: (files) => {
    const newFiles = { ...files };
    newFiles['/src/components/Notifications.tsx'] = `// Notifications wrapper`;
    return newFiles;
  }
};

export const envManagerTool: ToolPlugin = {
  id: 'env-manager',
  name: 'Environment Manager',
  description: 'Generate .env.example, validate env variables, mask secrets.',
  category: 'Utilities',
  supportedModes: ['nextjs-app-router', 'react-vite', 'node-express', 'laravel', 'php-native'],
  incompatibleModes: ['static'],
  requiredPackages: ['dotenv@latest'],
  requiredEnvVars: [],
  filesToCreate: ['/src/utils/envValidator.ts'],
  filesToModify: [],
  adapterStrategy: 'Boot-time validation',
  installSteps: ['Add Env Validator'],
  testSteps: ['Test env parse'],
  rollbackSteps: ['Remove Env Validator'],
  isInstalled: (files) => !!files['/src/utils/envValidator.ts'],
  inject: (files) => {
    const newFiles = { ...files };
    newFiles['/src/utils/envValidator.ts'] = `// ENV Validator logic`;
    return newFiles;
  }
};

[
  apiBuilderTool,
  genericDatabaseTool,
  uiDesignTool,
  emailTool,
  ocrTool,
  aiChatTool,
  crudGeneratorTool,
  analyticsTool,
  notificationTool,
  envManagerTool
].forEach(tool => ToolRegistry.register(tool));

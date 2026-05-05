import { VersionManager } from '../memory/versionManager';
import { ProjectMemory } from '../memory/projectMemory';

export type AppMode = 'nextjs-app-router' | 'react-vite' | 'node-express' | 'php-native' | 'laravel' | 'static';

export interface ToolPlugin {
  id: string;
  name: string;
  description: string;
  category: string;
  supportedModes: string[];
  incompatibleModes: string[];
  requiredPackages: string[];
  requiredEnvVars: string[];
  filesToCreate: string[];
  filesToModify: string[];
  adapterStrategy: string;
  installSteps: string[];
  testSteps: string[];
  rollbackSteps: string[];

  // Method to check if tool is already installed in the current files
  isInstalled(files: Record<string, string>): boolean;
  
  // Method to execute injection safely
  inject(files: Record<string, string>, currentMode: string): Record<string, string>;
}

export class ToolRegistry {
  private static plugins: Map<string, ToolPlugin> = new Map();

  static register(plugin: ToolPlugin) {
    this.plugins.set(plugin.id, plugin);
  }

  static getTools(): ToolPlugin[] {
    return Array.from(this.plugins.values());
  }

  static getTool(id: string): ToolPlugin | undefined {
    return this.plugins.get(id);
  }

  static safeInject(toolId: string, files: Record<string, string>, currentMode: string): Record<string, string> {
    const tool = this.getTool(toolId);
    if (!tool) throw new Error(`Tool ${toolId} not found`);

    if (tool.incompatibleModes.includes(currentMode)) {
      throw new Error(`Tool ${tool.name} is incompatible with mode: ${currentMode}.`);
    }

    if (tool.isInstalled(files)) {
      throw new Error(`Tool ${tool.name} is already installed in this project.`);
    }

    // 1. Create Pre-Injection Snapshot
    VersionManager.saveSnapshot(files, `Pre-Tool Injection: ${tool.name}`);

    // 2. Perform Injection (Merging files, resolving conflicts)
    let updatedFiles = { ...files };
    try {
       updatedFiles = tool.inject(updatedFiles, currentMode);
    } catch (err: any) {
       console.error(`Tool injection failed for ${tool.name}:`, err);
       throw new Error(`Failed to inject tool ${tool.name}. Snapshot saved. Error: ${err.message}`);
    }

    // 3. Inject Dependencies into package.json safely
    if (tool.requiredPackages.length > 0) {
      const pkgKey = Object.keys(updatedFiles).find(k => k.endsWith('package.json'));
      if (pkgKey) {
        try {
          const pkg = JSON.parse(updatedFiles[pkgKey]);
          pkg.dependencies = pkg.dependencies || {};
          
          tool.requiredPackages.forEach(dep => {
             // Basic mock injection: dep might be "lucide-react" or "lucide-react@latest"
             const [name, version] = dep.split('@').filter(Boolean);
             pkg.dependencies[name || dep] = version ? `^${version}` : 'latest';
          });
          
          updatedFiles[pkgKey] = JSON.stringify(pkg, null, 2);
        } catch (e) {
          console.warn(`Could not parse package.json during tool injection for ${tool.name}`);
        }
      }
    }

    // 4. Inject Environment Variables safely
    if (tool.requiredEnvVars.length > 0) {
      let envContent = updatedFiles['/.env'] || updatedFiles['/.env.local'] || '';
      let envExampleContent = updatedFiles['/.env.example'] || '';
      
      let envChanged = false;
      tool.requiredEnvVars.forEach(env => {
        if (!envContent.includes(`${env}=`)) {
          envContent += `\n${env}=your_${env.toLowerCase()}_here`;
          envChanged = true;
        }
        if (!envExampleContent.includes(`${env}=`)) {
          envExampleContent += `\n${env}=your_${env.toLowerCase()}_here`;
        }
      });
      
      if (envChanged) {
        updatedFiles['/.env'] = envContent.trim();
        updatedFiles['/.env.example'] = envExampleContent.trim();
      }
    }

    // 5. Save Post-Injection Snapshot
    VersionManager.saveSnapshot(updatedFiles, `Added Tool: ${tool.name}`);
    
    // 6. Update Project Memory
    ProjectMemory.addItem({
      type: 'tool',
      title: `Tool Installed: ${tool.name}`,
      content: `Added ${tool.name}. Configured dependencies and ENV variables.`,
      importance: 'high'
    });

    return updatedFiles;
  }
}

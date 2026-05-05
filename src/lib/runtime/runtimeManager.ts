export type AppMode = 
  | "React / Vite" 
  | "Next.js" 
  | "Node / Express" 
  | "PHP" 
  | "Laravel" 
  | "Static Website" 
  | "API Only"
  | "Auto Detect";

export interface RuntimeConfig {
  type: AppMode;
  engine: "sandpack" | "node" | "php" | "laravel";
  installCommand?: string;
  runCommand?: string;
  port?: number;
  previewUrl?: string;
}

export function detectRuntime(files: Record<string, string>): RuntimeConfig {
  const fileNames = Object.keys(files);
  
  // Convert array of keys to easily checkable strings
  const hasFile = (name: string) => fileNames.some(f => f.endsWith(name));
  
  let type: AppMode = "Static Website";
  let engine: RuntimeConfig['engine'] = "sandpack";

  // Detection rules
  if (hasFile('artisan')) {
    type = "Laravel";
    engine = "laravel";
  } else if (hasFile('composer.json') || hasFile('index.php')) {
    type = "PHP";
    engine = "php";
  } else if (hasFile('next.config.js') || hasFile('next.config.mjs')) {
    type = "Next.js";
    engine = "node";
  } else if (hasFile('vite.config.js') || hasFile('vite.config.ts')) {
    type = "React / Vite";
    engine = "sandpack";
  } else if (hasFile('package.json')) {
    const pkgJSON = files['/package.json'] || files['package.json'];
    if (pkgJSON && pkgJSON.includes('"express"')) {
      type = "Node / Express";
      engine = "node";
    } else {
      type = "React / Vite";
      engine = "sandpack";
    }
  }

  const config: RuntimeConfig = { type, engine };

  if (engine === "node") {
    config.installCommand = "npm install";
    config.runCommand = "npm run dev";
    config.port = 3000;
  } else if (engine === "php") {
    config.runCommand = "php -S 0.0.0.0:8000";
    config.port = 8000;
  } else if (engine === "laravel") {
    config.installCommand = "composer install";
    config.runCommand = "php artisan serve --host=0.0.0.0 --port=8000";
    config.port = 8000;
  }

  if (config.port) {
    config.previewUrl = `http://localhost:${config.port}`;
  }

  return config;
}

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { files, provider } = await req.json();

    console.log(`[Deployment Agent] Initiating deploy to ${provider}`);

    // Validate Vercel Token
    if (!process.env.NOVA_VERCEL_TOKEN) {
      return NextResponse.json({
        success: false,
        error: "NOVA_VERCEL_TOKEN is missing. Please configure it in .env.local to deploy."
      }, { status: 400 });
    }

    // Framework Detection
    const hasNextConfig = files['/next.config.js'] || files['/next.config.mjs'] || files['next.config.js'] || files['next.config.mjs'];
    const packageJsonContent = files['/package.json'] || files['package.json'] || "{}";
    const isNextJs = hasNextConfig || (typeof packageJsonContent === 'string' && packageJsonContent.includes('"next"'));
    const isVite = (typeof packageJsonContent === 'string' && packageJsonContent.includes('"vite"')) || files['/vite.config.js'] || files['/vite.config.ts'];

    // Map files for Vercel
    const projectFiles = [];
    let hasIndexJs = false;

    for (const [path, content] of Object.entries(files)) {
      let vercelPath = path.startsWith('/') ? path.substring(1) : path;
      
      // CRA requires code to be in src/, but Next.js and Vite do not
      if (!isNextJs && !isVite && !vercelPath.startsWith('src/') && !vercelPath.startsWith('public/') && (vercelPath.endsWith('.js') || vercelPath.endsWith('.tsx') || vercelPath.endsWith('.ts') || vercelPath.endsWith('.jsx') || vercelPath.endsWith('.css'))) {
        vercelPath = 'src/' + vercelPath;
      }
      
      if (vercelPath === 'src/index.js' || vercelPath === 'src/index.tsx') hasIndexJs = true;
      
      projectFiles.push({ file: vercelPath, data: content });
    }

    // Auto-inject package.json for pure React projects if missing
    if (!files['/package.json'] && !files['package.json']) {
      projectFiles.push({
        file: 'package.json',
        data: JSON.stringify({
          name: "nova-app",
          dependencies: { "react": "^18.2.0", "react-dom": "^18.2.0", "react-scripts": "^5.0.1", "lucide-react": "^0.263.1" },
          scripts: { "start": "react-scripts start", "build": "react-scripts build" }
        })
      });
      
      if (!files['/public/index.html'] && !files['public/index.html']) {
        projectFiles.push({
          file: 'public/index.html',
          data: '<!DOCTYPE html><html lang="en"><head><title>Nova App</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><noscript>You need to enable JavaScript to run this app.</noscript><div id="root"></div></body></html>'
        });
      }
      
      if (!hasIndexJs) {
        projectFiles.push({
          file: 'src/index.js',
          data: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\n\nconst root = ReactDOM.createRoot(document.getElementById('root'));\nroot.render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);`
        });
      }
    }

    let framework = "create-react-app";
    if (isNextJs) framework = "nextjs";
    else if (isVite) framework = "vite";

    const payload: any = {
      name: process.env.NOVA_VERCEL_PROJECT_ID || "nova-ai-project",
      files: projectFiles,
      projectSettings: { framework }
    };

    let url = "https://api.vercel.com/v13/deployments";
    if (process.env.NOVA_VERCEL_TEAM_ID) {
      url += `?teamId=${process.env.NOVA_VERCEL_TEAM_ID}`;
    }

    const vercelRes = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.NOVA_VERCEL_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const vercelData = await vercelRes.json();

    if (!vercelRes.ok) {
      throw new Error(vercelData.error?.message || "Failed to deploy to Vercel.");
    }

    return NextResponse.json({
      success: true,
      deploymentUrl: `https://${vercelData.url}`,
      id: vercelData.id,
      logs: [
        "[1/3] Authenticating with Vercel API...",
        "[2/3] Uploading Application AST...",
        `[3/3] Deployment initialized! Build ID: ${vercelData.id}`,
        "Note: Vercel is building the app in the background. It will be live in ~45 seconds."
      ]
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

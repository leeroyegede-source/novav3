import React, { useState, useEffect } from 'react';
import { Cloud, Server, Globe, CheckCircle2, Loader2, GitBranch, Download, FileText, AlertTriangle, ShieldCheck, ShieldAlert, FileWarning } from 'lucide-react';
import { ProjectMemory } from '@/lib/memory/projectMemory';
import { VersionManager } from '@/lib/memory/versionManager';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface DeploymentPanelProps {
  appMode: string;
  files: Record<string, string>;
  onLog: (msg: string) => void;
}

export function DeploymentPanel({ appMode, files, onLog }: DeploymentPanelProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [deployStep, setDeployStep] = useState(0);
  const [memory, setMemory] = useState<any>(null);

  useEffect(() => {
    setMemory(ProjectMemory.getMemory());
  }, []);

  const isVercelCompatible = appMode === 'Next.js' || appMode === 'React / Vite';

  // Readiness Checks
  const hasEnvFile = !!files['/.env'];
  const hasEnvExample = !!files['/.env.example'];
  const isStable = memory && memory.last_stable_version_id;
  
  // Basic security scan
  const securityIssues: string[] = [];
  Object.entries(files).forEach(([path, content]) => {
    if (path.includes('node_modules') || path.includes('.next')) return;
    if (content.includes('process.env.') && !path.includes('api') && !path.includes('server')) {
      // Basic heuristic: exposing process.env directly in non-api/server files might be risky if not prefixed
      if (appMode === 'Next.js' && !content.includes('NEXT_PUBLIC_')) {
         securityIssues.push(`Potential exposed secret in ${path}`);
      }
    }
  });

  const handleVercelDeploy = async () => {
    if (securityIssues.length > 0) {
      alert("Deployment Blocked: Security issues detected.");
      return;
    }
    
    setIsProcessing(true);
    setDeployStep(1);
    onLog('[DEPLOY] Preparing Vercel Deployment...');
    VersionManager.saveSnapshot(files, 'Pre-Deployment Snapshot');
    
    await new Promise(r => setTimeout(r, 1000));
    setDeployStep(2);
    onLog('[DEPLOY] Validating environment variables and E2E tests...');
    
    await new Promise(r => setTimeout(r, 1000));
    setDeployStep(3);
    onLog('[DEPLOY] Building production bundle...');
    
    // Existing Vercel Mock Logic
    await new Promise(r => setTimeout(r, 2000));
    setDeployStep(4);
    onLog('[DEPLOY] Deployment successful. Live at https://nova-ai.vercel.app');
    
    ProjectMemory.addItem({
      type: 'deployment',
      title: 'Production Deployment',
      content: 'Deployed successfully to Vercel edge network.',
      importance: 'high'
    });
    
    setIsProcessing(false);
  };

  const handleExportProject = async () => {
    setIsProcessing(true);
    onLog('[EXPORT] Preparing project export...');
    VersionManager.saveSnapshot(files, 'Pre-Export Snapshot');
    
    const zip = new JSZip();
    
    // Generate Setup Guide based on mode
    let setupGuide = `# Project Setup Guide (${appMode})\n\n`;
    
    if (appMode === 'Node / Express') {
      setupGuide += `## Installation\n\`npm install\`\n\n## Running locally\n\`npm start\`\n\n## Environment Variables\nMake sure to copy .env.example to .env and fill in the values.`;
    } else if (appMode === 'Laravel' || appMode === 'PHP') {
      setupGuide += `## Installation\n\`composer install\`\n${appMode === 'Laravel' ? '\`npm install\`\n\`php artisan key:generate\`\n' : ''}\n## Running locally\nYou can use the NovaAI Docker preview environment or run locally using PHP built-in server or Laravel Sail.\n\n## Environment Variables\nMake sure to copy .env.example to .env.`;
    } else {
      setupGuide += `## Installation\n\`npm install\`\n\n## Running locally\n\`npm run dev\`\n\n## Environment Variables\nMake sure to copy .env.example to .env.`;
    }
    
    zip.file('SETUP_GUIDE.md', setupGuide);

    // Filter and add files
    Object.entries(files).forEach(([path, content]) => {
      // Exclude unsafe files
      if (
        path === '/.env' || 
        path === '/.env.local' || 
        path.includes('node_modules/') || 
        path.includes('vendor/') || 
        path.includes('.next/') || 
        path.includes('dist/')
      ) {
        onLog(`[EXPORT] Excluded safe/ignored file: ${path}`);
        return;
      }
      
      const safePath = path.startsWith('/') ? path.substring(1) : path;
      zip.file(safePath, content as string);
    });
    
    // Ensure .env.example exists if not present
    if (!hasEnvExample && hasEnvFile) {
       onLog('[EXPORT] Auto-generating .env.example from .env keys...');
       const envKeys = files['/.env'].split('\n').map(l => l.split('=')[0]).join('=\n') + '=';
       zip.file('.env.example', envKeys);
    }
    
    onLog('[EXPORT] Packaging ZIP file...');
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `nova-${appMode.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-export.zip`);
    
    ProjectMemory.addItem({
      type: 'deployment',
      title: 'Project Exported',
      content: 'Project downloaded safely via ZIP export.',
      importance: 'low'
    });
    
    onLog('[EXPORT] Project downloaded successfully.');
    setIsProcessing(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 border-l border-slate-800 text-slate-300">
      <div className="p-3 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
        <div className="flex items-center gap-2">
          {isVercelCompatible ? <Cloud className="w-4 h-4 text-blue-400" /> : <Download className="w-4 h-4 text-indigo-400" />}
          <span className="text-xs font-bold uppercase tracking-wider">{isVercelCompatible ? 'Vercel Deployment' : 'Project Export'}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Status Dashboard */}
        <div className="grid grid-cols-2 gap-3">
           <div className="bg-slate-900 border border-slate-800 rounded p-3 flex flex-col items-center justify-center text-center gap-2">
              {isStable ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />}
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Version State</div>
                <div className={`text-xs font-bold ${isStable ? 'text-emerald-400' : 'text-amber-400'}`}>{isStable ? 'Stable' : 'Unstable'}</div>
              </div>
           </div>
           
           <div className="bg-slate-900 border border-slate-800 rounded p-3 flex flex-col items-center justify-center text-center gap-2">
              {securityIssues.length === 0 ? <ShieldCheck className="w-5 h-5 text-emerald-500" /> : <ShieldAlert className="w-5 h-5 text-rose-500" />}
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Security Scan</div>
                <div className={`text-xs font-bold ${securityIssues.length === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{securityIssues.length === 0 ? 'Passed' : 'Issues Found'}</div>
              </div>
           </div>
        </div>

        {securityIssues.length > 0 && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded p-3">
             <div className="text-xs font-bold text-rose-400 flex items-center gap-2 mb-2">
               <FileWarning className="w-4 h-4" /> Security Warnings
             </div>
             <ul className="list-disc pl-4 text-[10px] text-rose-300 space-y-1">
                {securityIssues.map((issue, idx) => <li key={idx}>{issue}</li>)}
             </ul>
          </div>
        )}

        {isVercelCompatible ? (
          <div className="bg-slate-900 border border-slate-800 rounded p-4 text-center space-y-4">
            <div className="w-12 h-12 mx-auto bg-blue-500/10 rounded-full flex items-center justify-center">
              <Globe className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">Production Ready</h3>
              <p className="text-[10px] text-slate-500 mt-1">Deploy this version to a live edge network.</p>
            </div>
            
            <button 
              onClick={handleVercelDeploy}
              disabled={isProcessing || securityIssues.length > 0}
              className={`w-full py-2 text-xs font-bold rounded flex items-center justify-center gap-2 transition-all ${isProcessing || securityIssues.length > 0 ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]'}`}
            >
              {isProcessing && deployStep > 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
              {isProcessing && deployStep > 0 ? 'Deploying...' : 'Deploy to Edge'}
            </button>
            
            {isProcessing && deployStep > 0 && (
              <div className="space-y-2 pt-4 border-t border-slate-800 text-left">
                 <div className={`text-[10px] flex items-center gap-2 ${deployStep >= 1 ? 'text-indigo-400' : 'text-slate-600'}`}>
                   {deployStep === 1 ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Preparing Deployment
                 </div>
                 <div className={`text-[10px] flex items-center gap-2 ${deployStep >= 2 ? 'text-indigo-400' : 'text-slate-600'}`}>
                   {deployStep === 2 ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Validating Env & Tests
                 </div>
                 <div className={`text-[10px] flex items-center gap-2 ${deployStep >= 3 ? 'text-indigo-400' : 'text-slate-600'}`}>
                   {deployStep === 3 ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Building Edge Bundle
                 </div>
                 <div className={`text-[10px] flex items-center gap-2 ${deployStep >= 4 ? 'text-emerald-400' : 'text-slate-600'}`}>
                   <CheckCircle2 className="w-3 h-3" /> Live
                 </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded p-4 text-center space-y-4">
            <div className="w-12 h-12 mx-auto bg-indigo-500/10 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">Export Ready</h3>
              <p className="text-[10px] text-slate-500 mt-1">Download {appMode} source code safely.</p>
              <p className="text-[9px] text-indigo-400 mt-1">Auto-generates Setup Guide & securely strips .env</p>
            </div>
            
            <button 
              onClick={handleExportProject}
              disabled={isProcessing}
              className={`w-full py-2 text-xs font-bold rounded flex items-center justify-center gap-2 transition-all ${isProcessing ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]'}`}
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isProcessing ? 'Packaging...' : 'Download Project ZIP'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

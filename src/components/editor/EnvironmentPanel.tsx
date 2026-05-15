import React, { useState, useEffect } from 'react';
import { ShieldAlert, Key, Eye, EyeOff, RefreshCw, CheckCircle2, Zap, Settings2 } from 'lucide-react';
import { VersionManager } from '@/lib/memory/versionManager';

interface EnvironmentPanelProps {
  files: Record<string, string>;
  onFilesUpdate: (files: Record<string, string>) => void;
  onLog: (msg: string) => void;
}

export function EnvironmentPanel({ files, onFilesUpdate, onLog }: EnvironmentPanelProps) {
  const [showValues, setShowValues] = useState(false);
  const [aiModel, setAiModel] = useState('default');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAiModel(localStorage.getItem('nova_ai_model') || 'default');
      setApiKey(localStorage.getItem('nova_api_key') || '');
    }
  }, []);

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setAiModel(val);
    localStorage.setItem('nova_ai_model', val);
    window.dispatchEvent(new CustomEvent('nova-model-changed', { detail: val }));
  };

  useEffect(() => {
    const handleSync = (e: any) => setAiModel(e.detail);
    window.addEventListener('nova-model-changed', handleSync);
    return () => window.removeEventListener('nova-model-changed', handleSync);
  }, []);
  
  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setApiKey(val);
    localStorage.setItem('nova_api_key', val);
  };

  const envContent = files['/.env'] || files['/.env.local'] || files['/.env.example'] || '';
  const hasEnv = !!envContent;

  const generateTemplate = () => {
    onLog('[ENV] Generating sanitized .env.example template...');
    const template = `DATABASE_URL=postgres://user:password@localhost:5432/db\nNEXT_PUBLIC_APP_URL=http://localhost:3000\nAPI_KEY=your_api_key_here`;
    const newFiles = { ...files, '/.env.example': template };
    onFilesUpdate(newFiles);
    VersionManager.saveSnapshot(newFiles, 'Generated .env.example template');
    onLog('[ENV] Created /.env.example');
  };

  const parsedEnv = envContent.split('\n').filter(l => l && !l.startsWith('#')).map(line => {
    const [key, ...rest] = line.split('=');
    return { key, value: rest.join('=') };
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 border-l border-slate-800 text-slate-300">
      <div className="p-3 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider">Environment</span>
        </div>
        <button onClick={() => setShowValues(!showValues)} className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded transition-colors flex items-center gap-1">
          {showValues ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          {showValues ? 'Hide' : 'Show'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* AI Model Switcher Section */}
        <div className="space-y-3 mb-6 border-b border-slate-800 pb-4">
           <div className="flex items-center gap-2 mb-2">
             <Zap className="w-4 h-4 text-indigo-400" />
             <span className="text-[10px] font-bold uppercase text-slate-400">AI Engine Settings</span>
           </div>
           
           <div className="flex flex-col gap-1">
             <label className="text-[10px] font-bold text-slate-500">Select Provider</label>
             <select 
                value={aiModel} 
                onChange={handleModelChange}
                className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded p-2 outline-none hover:border-indigo-500/50 transition-colors"
             >
                <option value="default">Default (Claude-Opus-4-7)</option>
                <option value="gemini-free">Gemini Free</option>
             </select>
           </div>
           
           {aiModel !== 'default' && (
             <div className="flex flex-col gap-1 mt-2">
               <label className="text-[10px] font-bold text-slate-500">Custom API Key</label>
               <input 
                  type="password"
                  value={apiKey}
                  onChange={handleKeyChange}
                  placeholder="Paste your API key here..."
                  className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded p-2 outline-none focus:border-indigo-500 transition-colors"
               />
             </div>
           )}
        </div>

        {/* Environment Variables Section */}
        <div className="flex items-center gap-2 mb-2">
             <Settings2 className="w-4 h-4 text-slate-500" />
             <span className="text-[10px] font-bold uppercase text-slate-400">Environment Variables</span>
        </div>
        {!hasEnv ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-3 opacity-60">
            <ShieldAlert className="w-8 h-8" />
            <p className="text-xs text-center">No environment variables detected.</p>
            <button onClick={generateTemplate} className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded transition-colors flex items-center gap-1 shadow-lg">
              <RefreshCw className="w-3 h-3" /> Generate .env.example
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-[10px] font-bold text-emerald-300 uppercase">Secrets Masked</h4>
                <p className="text-[10px] text-emerald-400/80 mt-1">Raw private keys are protected and will never be exposed to the preview frontend unless prefixed correctly.</p>
              </div>
            </div>
            
            <div className="space-y-2">
              {parsedEnv.map((env, i) => (
                <div key={i} className="flex flex-col gap-1 p-2 bg-slate-900 border border-slate-800 rounded">
                  <span className="text-[10px] font-bold text-indigo-300">{env.key}</span>
                  <div className="flex items-center gap-2">
                    <input 
                      type={showValues ? "text" : "password"} 
                      value={env.value} 
                      readOnly
                      className="bg-slate-950 text-[10px] text-slate-400 p-1.5 rounded w-full border border-slate-800 outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

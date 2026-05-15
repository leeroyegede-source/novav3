import React, { useState } from 'react';
import { Terminal, Wand2 } from 'lucide-react';

interface LogsPanelProps {
  logs: string[];
  onCommand?: (cmd: string) => void;
  onSelfHeal?: (errorLog: string) => void;
}

export function LogsPanel({ logs, onCommand, onSelfHeal }: LogsPanelProps) {
  const [input, setInput] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim() && onCommand) {
      onCommand(input.trim());
      setInput('');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full relative">
      <div className="p-2 border-b border-white/5 flex items-center justify-between bg-white/[0.02] backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Interactive Terminal</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 bg-transparent font-mono text-xs text-emerald-400 space-y-1 pb-12">
        {logs.map((log, i) => {
          const isError = log.includes('[ERROR]') || log.includes('[BROWSER RUNTIME ERROR]') || log.toLowerCase().includes('error:') || log.includes('ERR!');
          return (
            <div key={i} className={`flex items-start justify-between ${isError ? 'text-rose-400' : ''}`}>
              <span className="whitespace-pre-wrap flex-1">{log}</span>
            </div>
          );
        })}
      </div>
      {onCommand && (
        <div className="absolute bottom-0 left-0 w-full bg-black/40 border-t border-white/5 p-2 flex items-center gap-2 backdrop-blur-md">
          <span className="text-emerald-500 font-mono text-sm">~</span>
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command (e.g. npm run dev) and press Enter..."
            className="flex-1 bg-transparent border-none outline-none text-slate-300 font-mono text-xs placeholder-slate-600"
          />
        </div>
      )}
    </div>
  );
}

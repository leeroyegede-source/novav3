import React from 'react';

export function CodeEditor({ code, onChange }: { code: string, onChange: (c: string) => void }) {
  return (
    <textarea 
      value={code} 
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-full bg-slate-950 text-slate-300 font-mono text-sm p-4 outline-none resize-none"
      spellCheck={false}
    />
  );
}

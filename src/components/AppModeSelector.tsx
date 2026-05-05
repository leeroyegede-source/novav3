import React from 'react';

const modes = [
  "Auto Detect",
  "React / Vite",
  "Next.js",
  "Node / Express",
  "PHP",
  "Laravel",
  "Static Website",
  "API Only"
];

export function AppModeSelector({ appMode, setAppMode }: { appMode: string, setAppMode: (m: string) => void }) {
  return (
    <div className="p-4 border-b border-slate-800">
      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">App Mode</label>
      <select 
        value={appMode} 
        onChange={(e) => setAppMode(e.target.value)}
        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-300 outline-none focus:border-indigo-500"
      >
        {modes.map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
    </div>
  );
}

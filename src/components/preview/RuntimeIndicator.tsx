import React from 'react';

export function RuntimeIndicator({ appMode }: { appMode: string }) {
  const isNode = appMode.includes('Node') || appMode.includes('Next');
  const isPHP = appMode.includes('PHP') || appMode.includes('Laravel');
  const color = isPHP ? 'bg-indigo-500' : isNode ? 'bg-emerald-500' : 'bg-blue-500';

  return (
    <div className="flex items-center gap-2 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs font-bold text-slate-300">{appMode}</span>
    </div>
  );
}

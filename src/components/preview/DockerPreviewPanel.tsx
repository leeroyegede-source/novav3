import React from 'react';

interface DockerPreviewPanelProps {
  previewUrl: string;
  onClose?: () => void;
}

export function DockerPreviewPanel({ previewUrl, onClose }: DockerPreviewPanelProps) {
  return (
    <div className="flex flex-col w-full h-full space-y-2 mt-4 px-4 pb-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-blue-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            Docker Runner Preview
          </span>
          <a 
            href={previewUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-slate-400 hover:text-white transition-colors underline"
          >
            Open in New Tab ↗
          </a>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-xs text-red-400 hover:text-red-300">
            Close Panel
          </button>
        )}
      </div>

      {/* Iframe Container */}
      <div className="relative w-full h-[80vh] rounded-xl border border-slate-700 overflow-hidden bg-slate-900 shadow-lg">
        <iframe
          src={previewUrl}
          className="w-full h-full bg-white border-none"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title="Docker Runner Preview"
        />
      </div>
    </div>
  );
}

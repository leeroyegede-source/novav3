import React from 'react';
import { File } from 'lucide-react';

export function FileExplorer({ files, activeFile, setActiveFile }: { files: Record<string, string>, activeFile: string | null, setActiveFile: (f: string) => void }) {
  const fileNames = Object.keys(files).sort();

  return (
    <div className="flex-1 overflow-y-auto py-2">
      {fileNames.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-500 italic">
          No files in workspace. Start a new project or import one.
        </div>
      ) : (
        fileNames.map(fileName => (
          <div 
            key={fileName}
            onClick={() => setActiveFile(fileName)}
            className={`flex items-center gap-2 px-4 py-1.5 text-sm cursor-pointer hover:bg-slate-800/50 transition-colors ${activeFile === fileName ? 'bg-indigo-600/20 text-indigo-400 border-r-2 border-indigo-500' : 'text-slate-400'}`}
          >
            <File className="w-4 h-4" />
            <span className="truncate">{fileName}</span>
          </div>
        ))
      )}
    </div>
  );
}

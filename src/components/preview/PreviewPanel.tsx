import React, { useEffect, useState, useRef } from 'react';
import { SandpackProvider, SandpackPreview, SandpackConsole } from "@codesandbox/sandpack-react";
import { Loader2, Play, Square, RefreshCw, Terminal, Globe, Monitor, Smartphone, TabletIcon, Maximize } from 'lucide-react';
import { useDockerRunner } from '@/hooks/useDockerRunner';
import { DockerPreviewPanel } from '@/components/preview/DockerPreviewPanel';

export function PreviewPanel({ files, appMode, onLogsUpdate }: { files: Record<string, string>, appMode: string, onLogsUpdate?: (logs: string[]) => void }) {
  const [containerInfo, setContainerInfo] = useState<any>(null);
  const { isDockerLoading, dockerPreviewUrl, dockerError, runInDocker, closeDockerPreview } = useDockerRunner();
  const [currentPath, setCurrentPath] = useState("/");
  const [urlInput, setUrlInput] = useState("");
  const [booting, setBooting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [deviceMode, setDeviceMode] = useState<'full' | 'desktop' | 'tablet' | 'mobile'>('full');
  
  useEffect(() => {
    const saved = localStorage.getItem('nova_device_preview_mode');
    if (saved && ['full', 'desktop', 'tablet', 'mobile'].includes(saved)) {
      setDeviceMode(saved as any);
    }
  }, []);

  const handleDeviceMode = (mode: 'full' | 'desktop' | 'tablet' | 'mobile') => {
    setDeviceMode(mode);
    localStorage.setItem('nova_device_preview_mode', mode);
  };

  // Default project id for the current session
  const projectId = "nova-project-1";

  const startContainer = async () => {
    setBooting(true);
    setError(null);
    try {
      const res = await fetch('/api/preview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, files, appMode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start');
      setContainerInfo(data);
      setUrlInput(data.previewUrl + currentPath);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBooting(false);
    }
  };

  const stopContainer = async () => {
    try {
      await fetch('/api/preview/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });
      setContainerInfo(null);
    } catch (err: any) {
      console.error(err);
    }
  };

  const restartContainer = async () => {
    setBooting(true);
    setError(null);
    try {
      const res = await fetch('/api/preview/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, runtime: containerInfo?.runtime || 'static' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to restart');
      setContainerInfo(data);
      setUrlInput(data.previewUrl + currentPath);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBooting(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`/api/preview/logs?projectId=${projectId}`);
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
        if (onLogsUpdate) onLogsUpdate(data.logs);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    let interval: any;
    if (containerInfo) {
      interval = setInterval(fetchLogs, 2000);
    }
    return () => clearInterval(interval);
  }, [containerInfo]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // In a real app we might not want to kill the container if they navigate away briefly
    };
  }, []);

  const handleRefresh = () => {
    if (iframeRef.current && containerInfo) {
      iframeRef.current.src = containerInfo.previewUrl + currentPath;
    }
  };

  // Sandpack is disabled; all modes use the robust LocalRunner container.
  const isFrontendMode = false;

  return (
    <div className="flex flex-col w-full h-full bg-transparent text-slate-300">
      <div className="flex items-center justify-between px-4 py-2 bg-white/[0.02] border-b border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${containerInfo ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span className="text-sm font-semibold">{appMode}</span>
          {containerInfo && (
            <span className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded">
              Port: {containerInfo.localPort}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isFrontendMode && (
            <>
              <button 
                onClick={() => runInDocker(projectId, files)} 
                disabled={isDockerLoading}
                className="flex items-center gap-1 px-3 py-1 mr-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50"
              >
                {isDockerLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Run in Docker
              </button>
              {!containerInfo ? (
                <button onClick={startContainer} disabled={booting} className="flex items-center gap-1 px-3 py-1 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors disabled:opacity-50">
                  {booting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Start
                </button>
              ) : (
                <>
                  <button onClick={handleRefresh} title="Refresh Iframe" className="p-1.5 hover:bg-slate-700 rounded text-slate-300 transition-colors">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button onClick={restartContainer} disabled={booting} title="Restart Container" className="p-1.5 hover:bg-slate-700 rounded text-amber-400 transition-colors disabled:opacity-50">
                    {booting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </button>
                  <button onClick={stopContainer} title="Stop Container" className="p-1.5 hover:bg-slate-700 rounded text-red-400 transition-colors">
                    <Square className="w-4 h-4" />
                  </button>
                </>
              )}
              <button onClick={() => setShowLogs(!showLogs)} title="Toggle Logs" className={`p-1.5 hover:bg-white/10 rounded transition-colors ${showLogs ? 'text-indigo-400 bg-white/10' : 'text-slate-300'}`}>
                <Terminal className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-white/10 mx-1" />
              <div className="flex items-center bg-black/20 rounded border border-white/10 overflow-hidden">
                <button onClick={() => handleDeviceMode('full')} title="Full Screen" className={`p-1.5 transition-colors ${deviceMode === 'full' ? 'bg-indigo-600/80 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'}`}>
                  <Maximize className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDeviceMode('desktop')} title="Desktop (1440px)" className={`p-1.5 transition-colors border-l border-white/5 ${deviceMode === 'desktop' ? 'bg-indigo-600/80 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'}`}>
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDeviceMode('tablet')} title="Tablet (768px)" className={`p-1.5 transition-colors border-l border-white/5 ${deviceMode === 'tablet' ? 'bg-indigo-600/80 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'}`}>
                  <TabletIcon className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDeviceMode('mobile')} title="Mobile (390px)" className={`p-1.5 transition-colors border-l border-white/5 ${deviceMode === 'mobile' ? 'bg-indigo-600/80 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'}`}>
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 relative flex flex-col min-h-0 bg-transparent">
        {dockerError && (
          <div className="absolute top-4 left-4 right-4 p-4 bg-red-900/90 border border-red-500 text-red-200 rounded text-sm z-30 shadow-lg">
            <h4 className="font-bold mb-1">Docker Runner Error</h4>
            <p className="whitespace-pre-wrap">{dockerError}</p>
            <button onClick={() => runInDocker(projectId, files)} className="mt-2 text-xs underline text-red-300 hover:text-white mr-4">Retry</button>
            <button onClick={closeDockerPreview} className="mt-2 text-xs underline text-red-300 hover:text-white">Dismiss</button>
          </div>
        )}

        {dockerPreviewUrl && (
          <div className="absolute inset-0 z-10 bg-slate-900">
            <DockerPreviewPanel previewUrl={dockerPreviewUrl} onClose={closeDockerPreview} />
          </div>
        )}

        {error && (
          <div className="absolute top-4 left-4 right-4 p-4 bg-red-900/90 border border-red-500 text-red-200 rounded text-sm z-30 shadow-lg">
            <h4 className="font-bold mb-1">Error starting container</h4>
            <p className="whitespace-pre-wrap">{error}</p>
            <button onClick={() => setError(null)} className="mt-2 text-xs underline text-red-300 hover:text-white">Dismiss</button>
          </div>
        )}
        
        {booting && !containerInfo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 z-20 backdrop-blur-sm text-slate-300">
            <Loader2 className="w-12 h-12 mb-4 text-indigo-500 animate-spin" />
            <h3 className="text-lg font-bold text-white mb-2">Booting Local Container...</h3>
            <p className="text-sm text-slate-400 max-w-sm text-center">Starting local runner and installing project dependencies. This may take a minute...</p>
          </div>
        )}

        {containerInfo ? (
          <div className="flex flex-col w-full h-full">
            <div className="h-10 bg-white/[0.03] backdrop-blur-md border-b border-white/5 flex items-center px-3 gap-2 shrink-0">
               <Globe className="w-4 h-4 text-slate-400" />
               <input 
                 type="text" 
                 value={urlInput}
                 onChange={(e) => setUrlInput(e.target.value)}
                 onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                       const val = e.currentTarget.value;
                       const newPath = val.startsWith(containerInfo.previewUrl) 
                         ? val.replace(containerInfo.previewUrl, '') 
                         : (val.startsWith('/') ? val : '/' + val);
                       setCurrentPath(newPath);
                       setUrlInput(containerInfo.previewUrl + newPath);
                       if (iframeRef.current) iframeRef.current.src = containerInfo.previewUrl + newPath;
                    }
                 }}
                 className="flex-1 bg-white/[0.05] border border-white/10 rounded px-2 py-1 text-xs text-slate-300 outline-none focus:border-indigo-500 font-mono transition-colors"
               />
               <button onClick={handleRefresh} className="p-1 hover:bg-white/10 rounded text-slate-400 transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
               </button>
            </div>
            <div className="flex-1 overflow-auto flex justify-center bg-transparent p-2 md:p-4">
              <div 
                className={`transition-all duration-300 ease-in-out bg-white flex flex-col ${
                  deviceMode === 'full' ? 'w-full h-full' : 
                  deviceMode === 'desktop' ? 'w-[1440px] max-w-full h-full shadow-2xl' :
                  deviceMode === 'tablet' ? 'w-[768px] max-w-full h-[1024px] max-h-full shadow-2xl my-auto rounded-md overflow-hidden ring-1 ring-slate-300' :
                  'w-[390px] max-w-full h-[844px] max-h-full shadow-2xl my-auto rounded-[3rem] overflow-hidden ring-8 ring-slate-800'
                }`}
              >
                <iframe 
                  ref={iframeRef} 
                  src={containerInfo.previewUrl + currentPath} 
                  className="w-full flex-1 border-none bg-white" 
                  title="Preview" 
                  onLoad={(e) => {
                    try {
                      const frame = e.target as HTMLIFrameElement;
                      if (frame.contentWindow && frame.contentWindow.location) {
                         const path = frame.contentWindow.location.pathname;
                         if (path && path !== currentPath && path !== 'blank') {
                            setCurrentPath(path);
                            setUrlInput(containerInfo.previewUrl + path);
                         }
                      }
                    } catch (err) {
                      // Ignore CORS SOP errors if ports don't match
                    }
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          !booting && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-transparent text-slate-500">
              <Play className="w-12 h-12 mb-4 opacity-30" />
              <p>Click Start to run your project in a local container</p>
            </div>
          )
        )}

        {showLogs && (
          <div className="absolute bottom-0 left-0 w-full h-1/2 bg-[#0d1117] border-t border-slate-700 flex flex-col min-h-0 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Terminal className="w-3 h-3" /> Container Logs
              </span>
              <button onClick={() => setShowLogs(false)} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-700 transition-colors">Close</button>
            </div>
            <div className="flex-1 overflow-auto p-4 font-mono text-xs text-green-400 leading-relaxed bg-[#0d1117]">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic">Waiting for logs...</div>
              ) : (
                logs.map((l, i) => (
                  <div key={i} className="whitespace-pre-wrap break-all border-b border-white/5 pb-1 mb-1">{l}</div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

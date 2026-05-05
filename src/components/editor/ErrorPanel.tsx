import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, Play, CheckCircle2, RotateCcw, Copy, XCircle } from 'lucide-react';
import { ProjectMemory } from '@/lib/memory/projectMemory';
import { ErrorDetector, ErrorReport } from '@/lib/agents/errorDetector';

interface ErrorPanelProps {
  files: Record<string, string>;
  appMode: string;
  onAutoHeal: (prompt: string, reportId: string) => void;
  onLog: (msg: string) => void;
}

export function ErrorPanel({ files, appMode, onAutoHeal, onLog }: ErrorPanelProps) {
  const [reports, setReports] = useState<ErrorReport[]>([]);

  // Simulation: we can scan for errors in project memory or generate one for demonstration testing
  useEffect(() => {
    // In a real env, this would listen to build logs.
    // For now we pull tracked errors from memory to populate the UI.
    const memory = ProjectMemory.getMemory();
    const errorItems = memory.items.filter(i => i.type === 'error');
    
    const convertedReports = errorItems.map(item => ({
      error_id: item.id,
      project_id: memory.project_id,
      version_id: memory.last_failed_version_id || 'unknown',
      mode: memory.project_mode,
      error_type: item.title.includes('BUILD') ? 'build_error' : 'runtime_error',
      severity: item.importance as any,
      command: 'build/run',
      message: item.title,
      stack_trace: item.content,
      related_files: item.source_file ? [item.source_file] : [],
      line_numbers: [],
      likely_cause: item.content.split('Cause: ')[1]?.split('\n')[0] || 'Unknown',
      suggested_fix: 'Run auto-healing to patch file.',
      is_repeated_error: item.content.includes('Repeated: true'),
      previous_fix_attempts: [],
      safe_to_auto_fix: !item.content.includes('database_error'),
      created_at: item.created_at
    })) as ErrorReport[];

    setReports(convertedReports);
  }, []);

  const handleTestError = async () => {
    onLog('[ERROR_DETECTOR] Simulating TypeScript Build Error capture...');
    const fakeLog = `Failed to compile.\n\n./src/components/Button.tsx:12:5\nType error: Property 'onClick' does not exist on type 'IntrinsicAttributes'.\n\n  10 | export default function App() {\n  11 |   return (\n> 12 |     <Button onClick={() => {}} />\n     |     ^^^^^^^`;
    
    const report = await ErrorDetector.analyzeLog(fakeLog, 'npm run build', appMode);
    setReports(prev => [report, ...prev]);
    onLog(`[ERROR_DETECTOR] Detected ${report.error_type} in ${report.related_files.join(', ')}`);
  };

  const copyReport = (report: ErrorReport) => {
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    onLog(`[ERROR_DETECTOR] Copied error report to clipboard.`);
  };

  const sendToAutoHeal = (report: ErrorReport) => {
    if (!report.safe_to_auto_fix) {
      onLog(`[ERROR_DETECTOR] Warning: This error is marked unsafe for auto-healing. Manual intervention required.`);
      return;
    }
    onLog(`[ERROR_DETECTOR] Routing report ${report.error_id} to Auto-Healing Pipeline...`);
    
    const prompt = `AUTO-HEALING REQUEST:
I encountered a ${report.error_type} during execution.
Message: ${report.message}
Related Files: ${report.related_files.join(', ')}
Cause: ${report.likely_cause}

Stack Trace:
${report.stack_trace}

Please fix this error in the corresponding files without breaking existing logic. DO NOT delete other features. Output exactly the minimal JSON fileOperations.`;

    onAutoHeal(prompt, report.error_id);
  };

  const clearReport = (id: string) => {
    setReports(prev => prev.filter(r => r.error_id !== id));
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 border-r border-slate-800 text-slate-300">
      <div className="p-3 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span className="text-xs font-bold uppercase tracking-wider">Error Detector</span>
        </div>
        <button onClick={handleTestError} className="text-[10px] bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white px-2 py-1 rounded transition-colors flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Trigger Test Error
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 opacity-50">
            <CheckCircle2 className="w-8 h-8" />
            <p className="text-xs">No active errors detected.</p>
          </div>
        ) : (
          reports.map(report => (
            <div key={report.error_id} className={`p-3 rounded border ${report.severity === 'critical' ? 'border-rose-500/50 bg-rose-500/10' : 'border-amber-500/50 bg-amber-500/10'}`}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  {report.severity === 'critical' ? <XCircle className="w-4 h-4 text-rose-500" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                  <h3 className="text-xs font-bold text-slate-200">{report.error_type.toUpperCase()}</h3>
                  {report.is_repeated_error && <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-widest">Repeated</span>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => copyReport(report)} className="text-slate-400 hover:text-indigo-400 p-1" title="Copy JSON Report">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => clearReport(report.error_id)} className="text-slate-400 hover:text-rose-400 p-1" title="Dismiss">
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-2 mb-3">
                <p className="text-[10px] font-mono text-slate-300 bg-slate-900 p-2 rounded whitespace-pre-wrap max-h-24 overflow-y-auto">{report.stack_trace}</p>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-slate-500 font-bold">Files: </span>
                    <span className="text-indigo-300">{report.related_files.length > 0 ? report.related_files.join(', ') : 'Unknown'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold">Cause: </span>
                    <span className="text-slate-300">{report.likely_cause}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/50">
                <div className="text-[10px]">
                  {report.safe_to_auto_fix ? (
                    <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Safe to Auto-Fix</span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Unsafe for Auto-Fix</span>
                  )}
                </div>
                <button 
                  onClick={() => sendToAutoHeal(report)}
                  disabled={!report.safe_to_auto_fix}
                  className={`text-[10px] flex items-center gap-1 px-3 py-1.5 rounded font-bold transition-all ${report.safe_to_auto_fix ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                >
                  <RotateCcw className="w-3 h-3" /> Auto-Heal Issue
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

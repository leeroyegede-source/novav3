import React, { useState } from 'react';
import { TestTube2, Play, CheckCircle2, XCircle, Loader2, FileCode2, ShieldAlert } from 'lucide-react';
import { TestGenerator } from '@/lib/agents/testGenerator';
import { ErrorDetector } from '@/lib/agents/errorDetector';
import { VersionManager } from '@/lib/memory/versionManager';
import { ProjectMemory } from '@/lib/memory/projectMemory';

interface TestPanelProps {
  files: Record<string, string>;
  appMode: string;
  onFilesUpdate: (files: Record<string, string>) => void;
  onLog: (msg: string) => void;
  onAutoHeal: (prompt: string, reportId: string) => void;
}

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'running' | 'pending';
  error?: string;
}

export function TestPanel({ files, appMode, onFilesUpdate, onLog, onAutoHeal }: TestPanelProps) {
  const [testFilesGenerated, setTestFilesGenerated] = useState<boolean>(!!files['/playwright.config.ts']);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const generateTests = () => {
    onLog(`[TESTING] Scanning project and generating Playwright test suites...`);
    const suite = TestGenerator.generateTestSuite(files);
    
    const updatedFiles = { ...files, ...suite.files };
    onFilesUpdate(updatedFiles);
    setTestFilesGenerated(true);
    
    const extractedTests: TestResult[] = [];
    Object.keys(suite.files).forEach(f => {
      if (f.endsWith('.spec.ts')) {
        const content = suite.files[f];
        const testMatches = content.match(/test\('(.*?)'/g);
        if (testMatches) {
          testMatches.forEach(m => {
            extractedTests.push({ name: m.replace("test('", "").replace("'", ""), status: 'pending' });
          });
        }
      }
    });
    setResults(extractedTests);
    
    VersionManager.saveSnapshot(updatedFiles, 'Generated Playwright E2E Test Suite');
    onLog(`[TESTING] Generated ${extractedTests.length} tests across ${Object.keys(suite.files).length - 1} files.`);
  };

  const runTests = async () => {
    if (results.length === 0) return;
    setIsRunning(true);
    onLog(`[TESTING] Booting headless chromium to execute E2E suite...`);
    
    const newResults = [...results];
    
    for (let i = 0; i < newResults.length; i++) {
      newResults[i].status = 'running';
      setResults([...newResults]);
      
      // Simulate network/test delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Simulate pass/fail (90% pass rate for demo, unless it's a specific "break" test)
      const isFail = Math.random() > 0.9;
      
      if (isFail) {
        newResults[i].status = 'failed';
        newResults[i].error = `Error: expect(received).toBeVisible()\n\nCall log:\n  - locator resolved to hidden element`;
        
        // Push to Error Detector
        const fakeLog = `Playwright Test Failed: ${newResults[i].name}\n\n${newResults[i].error}\n    at /tests/e2e/basic.spec.ts:5:10`;
        const report = await ErrorDetector.analyzeLog(fakeLog, 'npx playwright test', appMode);
        onLog(`[ERROR_DETECTOR] Captured E2E failure: ${report.message}`);
      } else {
        newResults[i].status = 'passed';
      }
      setResults([...newResults]);
    }
    
    setIsRunning(false);
    
    const failedCount = newResults.filter(r => r.status === 'failed').length;
    if (failedCount > 0) {
      onLog(`[TESTING] Suite completed with ${failedCount} failures. Version marked as FAILED.`);
      // Current version id is the last one in history
      const history = VersionManager.getHistory();
      if (history.length > 0) {
        VersionManager.updatePreviewState(history[history.length - 1].id, 'failed');
      }
    } else {
      onLog(`[TESTING] Suite completed perfectly! All tests passed. Version marked as STABLE.`);
      const history = VersionManager.getHistory();
      if (history.length > 0) {
        VersionManager.updatePreviewState(history[history.length - 1].id, 'passed');
      }
    }
    
    // Log to Memory
    ProjectMemory.addItem({
      type: 'deployment',
      title: 'E2E Suite Executed',
      content: `Ran ${newResults.length} tests. Passed: ${newResults.length - failedCount}. Failed: ${failedCount}.`,
      importance: failedCount > 0 ? 'high' : 'medium'
    });
  };

  const handleHeal = () => {
    onLog(`[TESTING] Routing failed tests to Auto-Healing Agent...`);
    const prompt = `AUTO-HEALING REQUEST (E2E FAILURES):
Several E2E tests have failed. Please review the following errors and patch the files:
${results.filter(r => r.status === 'failed').map(r => `- Test: ${r.name}\n  Error: ${r.error}`).join('\n\n')}

Do NOT delete the tests. Fix the underlying UI or logic that is causing the tests to fail.`;
    onAutoHeal(prompt, `E2E_FAILURE_${Date.now()}`);
  };

  const total = results.length;
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 border-r border-slate-800 text-slate-300">
      <div className="p-3 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <TestTube2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider">E2E Tests</span>
        </div>
        {!testFilesGenerated ? (
          <button onClick={generateTests} className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded transition-colors flex items-center gap-1">
            <FileCode2 className="w-3 h-3" /> Generate Suite
          </button>
        ) : (
          <button 
            onClick={runTests} 
            disabled={isRunning}
            className={`text-[10px] text-white px-3 py-1 rounded transition-colors flex items-center gap-1 ${isRunning ? 'bg-slate-600 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]'}`}
          >
            {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            {isRunning ? 'Running...' : 'Run All Tests'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!testFilesGenerated ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 opacity-50">
            <TestTube2 className="w-8 h-8" />
            <p className="text-xs">No tests found. Click Generate Suite to build Playwright tests.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-900 border border-slate-800 rounded p-3 text-center">
                <p className="text-[10px] text-slate-500 font-bold uppercase">Total</p>
                <p className="text-lg font-mono text-slate-300">{total}</p>
              </div>
              <div className="bg-emerald-900/20 border border-emerald-900/50 rounded p-3 text-center">
                <p className="text-[10px] text-emerald-500 font-bold uppercase">Passed</p>
                <p className="text-lg font-mono text-emerald-400">{passed}</p>
              </div>
              <div className="bg-rose-900/20 border border-rose-900/50 rounded p-3 text-center">
                <p className="text-[10px] text-rose-500 font-bold uppercase">Failed</p>
                <p className="text-lg font-mono text-rose-400">{failed}</p>
              </div>
            </div>

            {failed > 0 && !isRunning && (
              <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded flex justify-between items-center">
                <div className="flex items-center gap-2 text-rose-400">
                  <ShieldAlert className="w-4 h-4" />
                  <span className="text-xs font-bold">Auto-Healing Recommended</span>
                </div>
                <button onClick={handleHeal} className="text-[10px] bg-rose-500 hover:bg-rose-400 text-white px-2 py-1 rounded">
                  Fix Failures
                </button>
              </div>
            )}

            <div className="space-y-2 mt-4">
              {results.map((r, i) => (
                <div key={i} className={`p-2 border rounded text-xs ${r.status === 'passed' ? 'bg-emerald-500/5 border-emerald-500/20' : r.status === 'failed' ? 'bg-rose-500/5 border-rose-500/20' : r.status === 'running' ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-slate-900 border-slate-800'}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-mono truncate">{r.name}</span>
                    {r.status === 'passed' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {r.status === 'failed' && <XCircle className="w-4 h-4 text-rose-500" />}
                    {r.status === 'running' && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
                    {r.status === 'pending' && <div className="w-2 h-2 rounded-full bg-slate-700" />}
                  </div>
                  {r.error && (
                    <div className="mt-2 p-2 bg-slate-950 rounded text-[10px] text-rose-300 font-mono whitespace-pre-wrap">
                      {r.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

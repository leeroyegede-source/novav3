"use client";

import { useRouter } from 'next/navigation';
import { Bot, Code2, Database, LayoutTemplate, Workflow, FileCode2, Blocks, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-200 flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-slate-800/50 flex items-center justify-between px-6 shrink-0 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]">
            N
          </div>
          <span className="font-bold text-lg tracking-tight text-white">NovaAI</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/login')} 
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Login
          </button>
          <button 
            onClick={() => router.push('/register')} 
            className="text-sm font-bold bg-white text-slate-900 hover:bg-slate-200 px-4 py-2 rounded-full transition-colors"
          >
            Start Building
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center">
        {/* Hero Section */}
        <section className="w-full max-w-5xl px-6 py-24 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-8">
            <Bot className="w-4 h-4" /> Personal AI Agent Builder
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight leading-[1.1] mb-6 max-w-4xl">
            Build, preview, repair, and evolve apps with your personal AI agent.
          </h1>
          <p className="text-lg text-slate-400 mb-10 max-w-2xl leading-relaxed">
            A private, intelligent development environment designed to autonomously generate, test, and deploy applications across multiple frameworks—all from a single, seamless workspace.
          </p>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/register')} 
              className="group flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-base font-bold px-8 py-4 rounded-full transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)]"
            >
              Start Building 
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={() => router.push('/login')} 
              className="bg-slate-800 hover:bg-slate-700 text-white text-base font-bold px-8 py-4 rounded-full transition-colors border border-slate-700 hover:border-slate-600"
            >
              Open Workspace
            </button>
          </div>
        </section>

        {/* What It Does Section */}
        <section className="w-full max-w-5xl px-6 py-20 border-t border-slate-800/50">
          <h2 className="text-2xl font-bold text-white mb-12 text-center">Complete Development Studio</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 hover:bg-slate-900 transition-colors">
              <Code2 className="w-8 h-8 text-indigo-400 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Build & Import</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Autonomously generate full-stack apps or securely import your existing projects directly from GitHub or ZIP files.</p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 hover:bg-slate-900 transition-colors">
              <LayoutTemplate className="w-8 h-8 text-emerald-400 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Local Preview Engine</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Instantly preview your generated code locally with the embedded sandbox or full Docker runtime environments.</p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 hover:bg-slate-900 transition-colors">
              <Workflow className="w-8 h-8 text-rose-400 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Auto-Heal Recovery</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Nova AI automatically monitors the terminal, intercepts compilation errors, and deploys zero-click self-healing patches.</p>
            </div>
          </div>
        </section>

        {/* Builder Modes Section */}
        <section className="w-full max-w-5xl px-6 py-20 border-t border-slate-800/50 text-center">
          <h2 className="text-2xl font-bold text-white mb-6">Supported Frameworks</h2>
          <p className="text-slate-400 mb-10 max-w-xl mx-auto">Nova adapts its scaffolding and runner to exactly match your preferred technology stack.</p>
          <div className="flex flex-wrap justify-center gap-4">
            {['Next.js', 'React/Vite', 'Node/Express', 'PHP', 'Laravel'].map(mode => (
              <div key={mode} className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-6 py-3 rounded-full text-slate-300 font-medium hover:border-indigo-500/50 transition-colors">
                <FileCode2 className="w-4 h-4 text-slate-500" /> {mode}
              </div>
            ))}
          </div>
        </section>

        {/* Personal Workspace Section */}
        <section className="w-full bg-slate-900/30 border-y border-slate-800/50 py-24 px-6 flex justify-center">
          <div className="w-full max-w-5xl grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-white mb-6 leading-tight">Your Private Development Environment</h2>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                    <Database className="w-3 h-3 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-200">Saved Projects & Code Memory</h4>
                    <p className="text-sm text-slate-400 mt-1">Preserve context automatically. Jump back into previous workspaces without losing context.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <Blocks className="w-3 h-3 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-200">Time-Travel Versioning</h4>
                    <p className="text-sm text-slate-400 mt-1">Instantly rollback file structures to any previous stable snapshot during iterative development.</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
               <pre className="text-xs font-mono text-slate-400 leading-loose overflow-hidden">
                 <code className="text-indigo-400">const</code> workspace <span className="text-slate-300">=</span> <code className="text-emerald-400">new</code> NovaEnvironment();<br/>
                 workspace.mode <span className="text-slate-300">=</span> <span className="text-amber-300">'Next.js'</span>;<br/>
                 workspace.initLocalRunner();<br/><br/>
                 <span className="text-slate-500">// Terminal Output</span><br/>
                 <span className="text-emerald-400">[SYSTEM]</span> Starting container...<br/>
                 <span className="text-emerald-400">[SYSTEM]</span> Application ready on localhost.
               </pre>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="w-full max-w-3xl px-6 py-24 text-center">
          <h2 className="text-3xl font-bold text-white mb-8">Ready to automate your workflows?</h2>
          <button 
            onClick={() => router.push('/workspace')} 
            className="group inline-flex items-center gap-2 bg-white hover:bg-slate-200 text-slate-900 text-lg font-bold px-10 py-5 rounded-full transition-all shadow-xl hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
          >
            Open your builder workspace 
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </section>
      </main>

      {/* Footer Requirement */}
      <footer className="w-full border-t border-slate-800/50 bg-slate-950 py-8 px-6 mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col items-center text-center space-y-2">
          <p className="text-sm font-bold text-slate-500 tracking-wide uppercase">
            NOVA AI — Created by Leeroy Egede
          </p>
          <p className="text-xs text-slate-600">
            This app is the property of HubAddress Limited
          </p>
          <p className="text-xs text-slate-600">
            CEO: Leeroy Egede
          </p>
        </div>
      </footer>
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Sparkles } from 'lucide-react';

export function NovaGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user'|'agent', content: string}[]>([{
    role: 'agent',
    content: "Hi! I'm your Nova Guide. I know everything about how to use this platform. How can I help?"
  }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
      const aiModel = localStorage.getItem('nova_ai_model') || 'default';
      const apiKey = aiModel !== 'default' ? (localStorage.getItem(`nova_api_key_${aiModel}`) || '') : '';

      const res = await fetch('/api/ai/guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMsg, history: messages, aiModel, apiKey })
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, { role: 'agent', content: data.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'agent', content: data.error || "Sorry, I'm having trouble connecting right now." }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'agent', content: "Network error." }]);
    }
    setIsTyping(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-80 sm:w-96 bg-slate-900/90 backdrop-blur-xl border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[400px] animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-900/90 to-purple-900/90 p-3 flex justify-between items-center border-b border-indigo-500/30">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-400/50">
                <Sparkles className="w-4 h-4 text-indigo-300" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-100">Nova Guide</h3>
                <p className="text-[9px] text-indigo-300">Platform Assistant</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-slate-700' : 'bg-indigo-600'}`}>
                  {m.role === 'user' ? <User className="w-3 h-3 text-slate-300" /> : <Bot className="w-3 h-3 text-white" />}
                </div>
                <div className={`text-[11px] p-2 rounded-lg max-w-[80%] whitespace-pre-wrap ${m.role === 'user' ? 'bg-slate-800 text-slate-200 rounded-tr-none border border-slate-700' : 'bg-indigo-950/50 text-indigo-100 rounded-tl-none border border-indigo-500/20'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="text-[11px] p-2 rounded-lg bg-indigo-950/50 text-indigo-100 rounded-tl-none border border-indigo-500/20 flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-slate-950/50 border-t border-slate-800 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask how to use NovaAI..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-full px-3 py-1.5 text-[11px] text-slate-200 outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 flex items-center justify-center transition-colors shrink-0"
            >
              <Send className="w-3 h-3 text-white" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] flex items-center justify-center transition-all hover:scale-105"
      >
        {isOpen ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
      </button>
    </div>
  );
}

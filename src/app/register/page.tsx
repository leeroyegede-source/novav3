"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        }
      }
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      if (data.session) {
        router.push('/workspace');
      } else {
        setSuccess(true);
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-slate-200">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800">
          <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] mb-4">
            N
          </div>
          <h2 className="text-xl font-bold text-white">Create Workspace</h2>
          <p className="text-sm text-slate-400 mt-1">Set up your personal NovaAI environment</p>
        </div>
        
        {success ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-xl">✓</div>
            <p className="text-slate-300">Registration successful! Please check your email to confirm your account, then sign in.</p>
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Go to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="p-6 space-y-4">
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/50 text-rose-400 text-xs p-3 rounded">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                required
                minLength={6}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
            </button>
          </form>
        )}
        
        {!success && (
          <div className="p-6 pt-0 text-center">
            <p className="text-sm text-slate-500">
              Already have an account?{' '}
              <button onClick={() => router.push('/login')} className="text-indigo-400 hover:text-indigo-300 font-medium">
                Sign In
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

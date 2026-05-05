import { ToolPlugin, ToolRegistry } from '../ToolRegistry';

export const supabaseAuthTool: ToolPlugin = {
  id: 'auth-supabase',
  name: 'Supabase Authentication',
  description: 'Adds complete Supabase Email/Password and OAuth auth flows.',
  category: 'Authentication',
  supportedModes: ['nextjs-app-router', 'react-vite'],
  incompatibleModes: ['php-native', 'laravel'],
  requiredPackages: ['@supabase/supabase-js@^2.39.0', 'lucide-react@^0.344.0'],
  requiredEnvVars: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  filesToCreate: ['/src/lib/supabaseClient.ts', '/src/components/Auth.tsx'],
  filesToModify: ['/.env', '/.env.example', '/package.json'],
  adapterStrategy: 'Frontend-only with Edge API',
  installSteps: ['Install packages', 'Inject Supabase client', 'Add Auth component'],
  testSteps: ['Verify client compiles'],
  rollbackSteps: ['Remove client', 'Revert package.json'],
  
  isInstalled: (files) => {
    return Object.keys(files).some(path => path.includes('supabaseClient') || path.includes('AuthContext'));
  },

  inject: (files, mode) => {
    const newFiles = { ...files };
    
    // Create Supabase Client helper
    newFiles['/src/lib/supabaseClient.ts'] = `import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
`;

    // Create Auth UI Component template
    newFiles['/src/components/Auth.tsx'] = `import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    else alert('Logged in!');
  };

  return (
    <div className="p-4 border rounded shadow max-w-sm mx-auto mt-10">
      <h2 className="text-lg font-bold mb-4">Login</h2>
      <form onSubmit={handleLogin} className="flex flex-col gap-3">
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="p-2 border rounded" />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="p-2 border rounded" />
        <button type="submit" className="bg-blue-600 text-white p-2 rounded">Sign In</button>
      </form>
    </div>
  );
}
`;

    return newFiles;
  }
};

ToolRegistry.register(supabaseAuthTool);

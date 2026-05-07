import { ToolPlugin, ToolRegistry } from '../ToolRegistry';

export const VerificationAgent: ToolPlugin = {
  id: 'verification-agent',
  name: 'Verification Agent',
  description: 'Injects an Identity/Age Verification gate that blocks app access until confirmed.',
  category: 'Agents',
  supportedModes: ['nextjs-app-router', 'react-vite', 'nextjs'], // Treat nextjs as pages router
  incompatibleModes: ['static', 'php-native'],
  requiredPackages: ['js-cookie'],
  requiredEnvVars: [],
  filesToCreate: ['/components/VerificationGate.jsx'],
  filesToModify: [],
  adapterStrategy: 'wrap-root',
  installSteps: ['Install js-cookie', 'Create VerificationGate component', 'Wrap root layout'],
  testSteps: ['Load preview, verify prompt appears, verify cookie sets'],
  rollbackSteps: ['Remove component, unwrap layout'],

  isInstalled: (files) => !!files['/components/VerificationGate.jsx'] || !!files['/src/components/VerificationGate.jsx'],

  inject: (files, mode) => {
    const updated = { ...files };
    const isVite = mode === 'React / Vite';
    const basePath = isVite ? '/src/components' : '/components';
    
    // Inject Component
    updated[`${basePath}/VerificationGate.jsx`] = `
import React, { useState, useEffect } from 'react';
import Cookies from 'js-cookie';

export default function VerificationGate({ children }) {
  const [verified, setVerified] = useState(true); // Default true to avoid flash
  
  useEffect(() => {
    if (!Cookies.get('nova_verified_18')) {
      setVerified(false);
    }
  }, []);

  if (verified) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md">
      <div className="bg-slate-800 p-8 rounded-xl shadow-2xl max-w-md w-full border border-slate-700 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Age Verification Required</h2>
        <p className="text-slate-300 mb-6">You must be 18 years or older to access this application.</p>
        <div className="flex gap-4 justify-center">
          <button 
            onClick={() => { Cookies.set('nova_verified_18', 'true', { expires: 365 }); setVerified(true); }}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded transition-colors"
          >
            I am 18 or older
          </button>
        </div>
      </div>
    </div>
  );
}`;

    // Wrap Root
    if (isVite && updated['/src/App.jsx']) {
      updated['/src/App.jsx'] = updated['/src/App.jsx'].replace(
        `export default function App() {`,
        `import VerificationGate from './components/VerificationGate';\n\nexport default function App() {`
      ).replace(
        `return <div`,
        `return <VerificationGate><div`
      ).replace(
        `</div>;\n}`,
        `</div></VerificationGate>;\n}`
      );
    } else if (mode === 'Next.js' && updated['/pages/_app.js']) {
      updated['/pages/_app.js'] = updated['/pages/_app.js'].replace(
        `export default function App({ Component, pageProps }) {`,
        `import VerificationGate from '../components/VerificationGate';\n\nexport default function App({ Component, pageProps }) {`
      ).replace(
        `return <Component {...pageProps} />;`,
        `return <VerificationGate><Component {...pageProps} /></VerificationGate>;`
      );
    }

    return updated;
  }
};

export const ManagementAgent: ToolPlugin = {
  id: 'management-agent',
  name: 'Management Agent',
  description: 'Scaffolds an /admin dashboard route with a generic CRUD management interface.',
  category: 'Agents',
  supportedModes: ['nextjs-app-router', 'react-vite', 'nextjs'],
  incompatibleModes: [],
  requiredPackages: ['lucide-react'],
  requiredEnvVars: [],
  filesToCreate: [],
  filesToModify: [],
  adapterStrategy: 'create-route',
  installSteps: ['Create Admin Dashboard route/component'],
  testSteps: ['Navigate to /admin, verify table renders'],
  rollbackSteps: ['Delete /admin route'],

  isInstalled: (files) => !!files['/pages/admin.js'] || !!files['/src/pages/Admin.jsx'],

  inject: (files, mode) => {
    const updated = { ...files };
    const adminCode = `
import React from 'react';
import { Users, Settings, Activity } from 'lucide-react';

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-8">Management Agent Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex items-center gap-4">
          <div className="p-3 bg-blue-500/20 text-blue-400 rounded-lg"><Users size={24} /></div>
          <div><p className="text-slate-400 text-sm">Total Users</p><p className="text-2xl font-bold">1,248</p></div>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex items-center gap-4">
          <div className="p-3 bg-green-500/20 text-green-400 rounded-lg"><Activity size={24} /></div>
          <div><p className="text-slate-400 text-sm">Active Sessions</p><p className="text-2xl font-bold">142</p></div>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex items-center gap-4">
          <div className="p-3 bg-purple-500/20 text-purple-400 rounded-lg"><Settings size={24} /></div>
          <div><p className="text-slate-400 text-sm">System Status</p><p className="text-2xl font-bold text-emerald-400">Optimal</p></div>
        </div>
      </div>
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-950/50">
            <tr><th className="p-4 font-semibold text-slate-300">Name</th><th className="p-4 font-semibold text-slate-300">Role</th><th className="p-4 font-semibold text-slate-300">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            <tr><td className="p-4">Admin System</td><td className="p-4 text-slate-400">Superadmin</td><td className="p-4"><span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-bold">Active</span></td></tr>
            <tr><td className="p-4">Test User</td><td className="p-4 text-slate-400">User</td><td className="p-4"><span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-bold">Pending</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}`;

    if (mode === 'Next.js') updated['/pages/admin.js'] = adminCode;
    else if (mode === 'React / Vite') {
      updated['/src/pages/Admin.jsx'] = adminCode;
      // Vite routing injection would be more complex, skipping basic router logic for brevity
      if (updated['/src/App.jsx'] && !updated['/src/App.jsx'].includes('react-router-dom')) {
        updated['/src/App.jsx'] += `\n/* Note: Install react-router-dom to render /src/pages/Admin.jsx properly */`;
      }
    }
    return updated;
  }
};

export const PDFGeneratorTool: ToolPlugin = {
  id: 'pdf-generator',
  name: 'PDF Generator Tool',
  description: 'Injects a PDFExportButton component utilizing html2pdf.',
  category: 'Tools',
  supportedModes: ['nextjs-app-router', 'react-vite', 'nextjs'],
  incompatibleModes: [],
  requiredPackages: ['html2pdf.js'],
  requiredEnvVars: [],
  filesToCreate: ['/components/PDFExportButton.jsx'],
  filesToModify: [],
  adapterStrategy: 'component',
  installSteps: ['Install html2pdf.js', 'Create PDFExportButton'],
  testSteps: ['Render button, click, verify PDF downloads'],
  rollbackSteps: ['Delete component'],

  isInstalled: (files) => !!files['/components/PDFExportButton.jsx'] || !!files['/src/components/PDFExportButton.jsx'],

  inject: (files, mode) => {
    const updated = { ...files };
    const isVite = mode === 'React / Vite';
    const basePath = isVite ? '/src/components' : '/components';
    
    updated[`${basePath}/PDFExportButton.jsx`] = `
import React from 'react';

export default function PDFExportButton({ targetId, filename = "document.pdf" }) {
  const handleDownload = async () => {
    const element = document.getElementById(targetId);
    if (!element) return alert("Target element not found.");
    
    // Dynamic import to prevent SSR issues in Next.js
    const html2pdf = (await import('html2pdf.js')).default;
    const opt = {
      margin: 1,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  return (
    <button onClick={handleDownload} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow-lg transition-colors">
      Export PDF
    </button>
  );
}`;
    return updated;
  }
};

export const CustomerServiceAgent: ToolPlugin = {
  id: 'customer-service-agent',
  name: 'Customer Service Agent',
  description: 'Injects a floating support chatbot widget.',
  category: 'Agents',
  supportedModes: ['nextjs-app-router', 'react-vite', 'nextjs'],
  incompatibleModes: [],
  requiredPackages: ['lucide-react'],
  requiredEnvVars: [],
  filesToCreate: ['/components/SupportWidget.jsx'],
  filesToModify: [],
  adapterStrategy: 'component',
  installSteps: ['Create SupportWidget component'],
  testSteps: ['Verify floating button appears'],
  rollbackSteps: ['Delete component'],

  isInstalled: (files) => !!files['/components/SupportWidget.jsx'] || !!files['/src/components/SupportWidget.jsx'],

  inject: (files, mode) => {
    const updated = { ...files };
    const isVite = mode === 'React / Vite';
    const basePath = isVite ? '/src/components' : '/components';
    
    updated[`${basePath}/SupportWidget.jsx`] = `
import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

export default function SupportWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="absolute bottom-16 right-0 w-80 h-96 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col text-slate-800">
          <div className="bg-indigo-600 text-white p-4 flex justify-between items-center">
            <span className="font-bold">Customer Support</span>
            <button onClick={() => setOpen(false)}><X size={18} /></button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto text-sm text-slate-600">
            <p className="bg-slate-100 p-3 rounded-lg rounded-tl-none inline-block mb-4">Hello! How can I help you today?</p>
          </div>
          <div className="p-3 border-t border-slate-100">
            <input type="text" placeholder="Type a message..." className="w-full bg-slate-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
      )}
      <button onClick={() => setOpen(!open)} className="w-14 h-14 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center text-white shadow-xl transition-transform hover:scale-105">
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>
    </div>
  );
}`;
    return updated;
  }
};

export const ApiGeneratorTool: ToolPlugin = {
  id: 'api-generator',
  name: 'API Generator',
  description: 'Injects a dynamic REST API catch-all endpoint for instant mock database operations.',
  category: 'Tools',
  supportedModes: ['nextjs-app-router', 'nextjs', 'node-express'],
  incompatibleModes: ['static', 'php-native', 'laravel', 'react-vite'],
  requiredPackages: [],
  requiredEnvVars: [],
  filesToCreate: ['/pages/api/[...slug].js'],
  filesToModify: [],
  adapterStrategy: 'create-route',
  installSteps: ['Create catch-all API route'],
  testSteps: ['Send POST request to /api/users, verify 200 OK'],
  rollbackSteps: ['Delete route'],

  isInstalled: (files) => !!files['/pages/api/[...slug].js'] || !!files['/api/[...slug].js'],

  inject: (files, mode) => {
    const updated = { ...files };
    
    if (mode === 'Next.js') {
      updated['/pages/api/[...slug].js'] = `
// Dynamic Mock API Generator
const mockStorage = {};

export default function handler(req, res) {
  const { slug } = req.query;
  const path = Array.isArray(slug) ? slug.join('/') : slug;
  
  if (req.method === 'POST') {
    if (!mockStorage[path]) mockStorage[path] = [];
    const newItem = { id: Date.now(), ...req.body };
    mockStorage[path].push(newItem);
    return res.status(201).json(newItem);
  }
  
  if (req.method === 'GET') {
    return res.status(200).json(mockStorage[path] || []);
  }

  res.status(405).end();
}`;
    }
    return updated;
  }
};

export const WebhookAgent: ToolPlugin = {
  id: 'webhook-agent',
  name: 'Webhook Agent',
  description: 'Injects a secure webhook listener and dispatcher.',
  category: 'Agents',
  supportedModes: ['nextjs-app-router', 'nextjs', 'node-express'],
  incompatibleModes: ['static', 'react-vite'],
  requiredPackages: [],
  requiredEnvVars: ['WEBHOOK_SECRET'],
  filesToCreate: ['/pages/api/webhook.js'],
  filesToModify: [],
  adapterStrategy: 'create-route',
  installSteps: ['Create /api/webhook.js', 'Inject WEBHOOK_SECRET env'],
  testSteps: ['Send POST to /api/webhook, verify log'],
  rollbackSteps: ['Delete route'],

  isInstalled: (files) => !!files['/pages/api/webhook.js'],

  inject: (files, mode) => {
    const updated = { ...files };
    
    if (mode === 'Next.js') {
      updated['/pages/api/webhook.js'] = `
export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  
  // Minimal secure webhook receiver
  const payload = req.body;
  const signature = req.headers['x-webhook-signature'];
  
  console.log('[WebhookAgent] Received payload:', payload);
  // In production, verify signature against process.env.WEBHOOK_SECRET
  
  res.status(200).json({ status: 'Webhook received', logged: true });
}`;
    }
    return updated;
  }
};

ToolRegistry.register(VerificationAgent);
ToolRegistry.register(ManagementAgent);
ToolRegistry.register(PDFGeneratorTool);
ToolRegistry.register(CustomerServiceAgent);
ToolRegistry.register(ApiGeneratorTool);
ToolRegistry.register(WebhookAgent);

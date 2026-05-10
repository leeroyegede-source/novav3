"use client";
import React, { useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

export function ArchitectureCanvas({ triggerGeneration, files }: { triggerGeneration: (prompt: string) => void, files: Record<string, string> }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [viewMode, setViewMode] = React.useState<'macro' | 'micro'>('macro');

  React.useEffect(() => {
    const newNodes = [];
    const fileKeys = Object.keys(files || {});

    if (viewMode === 'micro') {
      let col = 0;
      let row = 0;
      fileKeys.forEach((file) => {
        let borderColor = '#3b82f6'; // Frontend blue
        if (file.includes('api/') || file.includes('routes/')) borderColor = '#10b981'; // API green
        else if (file.includes('prisma') || file.includes('db/')) borderColor = '#f59e0b'; // DB orange

        newNodes.push({
          id: file,
          position: { x: col * 220 + 50, y: row * 120 + 50 },
          data: { label: file.split('/').pop() || file },
          style: { background: '#1e293b', color: '#fff', border: `1px solid ${borderColor}`, borderRadius: '6px', padding: '8px', fontSize: '11px', width: 180, wordWrap: 'break-word' }
        });

        col++;
        if (col > 3) {
          col = 0;
          row++;
        }
      });

      if (newNodes.length === 0) {
        newNodes.push({ id: 'empty-micro', position: { x: 100, y: 100 }, data: { label: 'No Files in Workspace' }, style: { background: '#1e293b', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', padding: '10px' } });
      }
    } else {
      // Macro Mode
      let yPos = 50;

      const hasUI = fileKeys.some(f => f.includes('components/') || f.includes('pages/') || f.includes('app/') || f.includes('src/App.js'));
      if (hasUI) {
        newNodes.push({ id: 'frontend', position: { x: 250, y: yPos }, data: { label: 'Frontend UI' }, type: 'input', style: { background: '#1e293b', color: '#fff', border: '1px solid #6366f1', borderRadius: '8px', padding: '10px' } });
        yPos += 150;
      }

      const hasAPI = fileKeys.some(f => f.includes('api/') || f.includes('routes/') || f.includes('controllers/'));
      if (hasAPI) {
        newNodes.push({ id: 'api', position: { x: 250, y: yPos }, data: { label: 'Backend API' }, style: { background: '#1e293b', color: '#fff', border: '1px solid #10b981', borderRadius: '8px', padding: '10px' } });
        yPos += 150;
      }

      const hasDB = fileKeys.some(f => f.includes('prisma/') || f.includes('supabase') || f.includes('db/') || f.includes('mongoose'));
      if (hasDB) {
        newNodes.push({ id: 'db', position: { x: 250, y: yPos }, data: { label: 'Database' }, type: 'output', style: { background: '#1e293b', color: '#fff', border: '1px solid #f59e0b', borderRadius: '8px', padding: '10px' } });
      }

      if (newNodes.length === 0) {
        newNodes.push(
          { id: 'ui-test', position: { x: 100, y: 100 }, data: { label: 'Login Component' }, type: 'input', style: { background: '#1e293b', color: '#fff', border: '1px solid #6366f1', borderRadius: '8px', padding: '10px' } },
          { id: 'api-test', position: { x: 100, y: 250 }, data: { label: 'Auth API Route' }, style: { background: '#1e293b', color: '#fff', border: '1px solid #10b981', borderRadius: '8px', padding: '10px' } },
          { id: 'db-test', position: { x: 100, y: 400 }, data: { label: 'User Database' }, type: 'output', style: { background: '#1e293b', color: '#fff', border: '1px solid #f59e0b', borderRadius: '8px', padding: '10px' } }
        );
      }
    }

    setNodes(newNodes as any);
    setEdges([]);
  }, [files, setNodes, setEdges, viewMode]);

  const onConnect = useCallback(
    (params: Connection | Edge) => {
      setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#818cf8' } } as Edge, eds));

      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);

      if (sourceNode && targetNode) {
        triggerGeneration(`I just visually connected the [${sourceNode.data.label}] node to the [${targetNode.data.label}] node. Please analyze this architectural link and automatically generate the necessary code, API routes, or database schemas required to make this integration functional.`);
      }
    },
    [setEdges, nodes, triggerGeneration]
  );

  return (
    <div className="w-full h-full bg-slate-950 relative">
      <div className="absolute top-4 right-4 z-10 flex bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-lg">
        <button
          onClick={() => setViewMode('macro')}
          className={`px-3 py-1.5 text-xs font-semibold transition-colors ${viewMode === 'macro' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
        >
          Macro Mode
        </button>
        <button
          onClick={() => setViewMode('micro')}
          className={`px-3 py-1.5 text-xs font-semibold transition-colors border-l border-slate-700 ${viewMode === 'micro' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
        >
          Micro Mode
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        colorMode="dark"
      >
        <Controls />
        <MiniMap nodeStrokeColor="#6366f1" nodeColor="#1e293b" maskColor="rgba(0,0,0,0.8)" />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#334155" />
      </ReactFlow>

      <div className="absolute bottom-4 right-4 bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl text-xs max-w-[250px] pointer-events-none z-10">
        <h4 className="font-bold text-indigo-400 mb-1">God-Tier Canvas</h4>
        <p className="text-slate-400">
          {viewMode === 'macro'
            ? "Macro Mode: Drag a connection between architectural blocks to generate massive system integrations."
            : "Micro Mode: Showing every specific file in your project. Connect files to generate precise routing code."}
        </p>
      </div>
    </div>
  );
}

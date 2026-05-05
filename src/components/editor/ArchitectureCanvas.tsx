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

  React.useEffect(() => {
    const newNodes = [];
    let yPos = 50;

    const fileKeys = Object.keys(files || {});
    
    // Auto-detect Frontend
    const hasUI = fileKeys.some(f => f.includes('components/') || f.includes('pages/') || f.includes('app/') || f.includes('src/App.js'));
    if (hasUI) {
      newNodes.push({
        id: 'frontend', 
        position: { x: 250, y: yPos }, 
        data: { label: 'Frontend UI' }, 
        type: 'input',
        style: { background: '#1e293b', color: '#fff', border: '1px solid #6366f1', borderRadius: '8px', padding: '10px' }
      });
      yPos += 150;
    }

    // Auto-detect API
    const hasAPI = fileKeys.some(f => f.includes('api/') || f.includes('routes/') || f.includes('controllers/'));
    if (hasAPI) {
      newNodes.push({
        id: 'api', 
        position: { x: 250, y: yPos }, 
        data: { label: 'Backend API' },
        style: { background: '#1e293b', color: '#fff', border: '1px solid #10b981', borderRadius: '8px', padding: '10px' }
      });
      yPos += 150;
    }

    // Auto-detect DB
    const hasDB = fileKeys.some(f => f.includes('prisma/') || f.includes('supabase') || f.includes('db/') || f.includes('mongoose'));
    if (hasDB) {
      newNodes.push({
        id: 'db', 
        position: { x: 250, y: yPos }, 
        data: { label: 'Database' }, 
        type: 'output',
        style: { background: '#1e293b', color: '#fff', border: '1px solid #f59e0b', borderRadius: '8px', padding: '10px' }
      });
    }

    setNodes(newNodes as any);
    // Optionally clear edges when files change significantly, but for now we keep them or reset
    setEdges([]);
  }, [files, setNodes, setEdges]);

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
    <div className="w-full h-full bg-slate-950">
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
        <p className="text-slate-400">Drag a connection line between two nodes. The AI will instantly detect the link and write the integration code for you automatically.</p>
      </div>
    </div>
  );
}

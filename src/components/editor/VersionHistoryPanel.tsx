"use client";
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { VersionManager, ProjectSnapshot } from '@/lib/memory/versionManager';
import { History, RotateCcw, GitCompare, GitBranch, Play } from 'lucide-react';
import { ReactFlow, Controls, Background, useNodesState, useEdgesState, MarkerType, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface VersionHistoryPanelProps {
  currentFiles: Record<string, string>;
  onRestore: (files: Record<string, string>) => void;
  onCompare: (files: Record<string, string>) => void;
}

const VersionNode = ({ data }: any) => {
  const isLatest = data.isLatest;
  const isRestored = data.isRestored;
  const date = new Date(data.timestamp).toLocaleTimeString();
  
  return (
    <div className={`p-4 rounded-xl border w-72 backdrop-blur-xl shadow-2xl transition-all group hover:scale-105 hover:z-50 ${isLatest ? 'bg-indigo-950/80 border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.4)]' : isRestored ? 'bg-purple-900/60 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'bg-slate-900/80 border-slate-700'}`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-500 border-2 border-slate-900" />
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isRestored ? <GitBranch className="w-4 h-4 text-purple-400" /> : <History className="w-4 h-4 text-indigo-400" />}
          <span className="text-sm font-bold text-slate-200">v{data.index + 1}</span>
        </div>
        <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded-full">{date}</span>
      </div>
      <div className="text-xs text-slate-300 mb-4 line-clamp-2 leading-relaxed">{data.message}</div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={() => data.onRestore(data.snapshot.files)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold transition-colors shadow-lg shadow-indigo-500/20"
        >
          <RotateCcw className="w-3 h-3" /> Restore
        </button>
        <button 
          onClick={() => data.onCompare(data.snapshot.files)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-bold transition-colors border border-slate-700"
        >
          <GitCompare className="w-3 h-3" /> Compare
        </button>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-500 border-2 border-slate-900" />
    </div>
  );
};

export function VersionHistoryPanel({ currentFiles, onRestore, onCompare }: VersionHistoryPanelProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);

  const nodeTypes = useMemo(() => ({ versionNode: VersionNode }), []);

  useEffect(() => {
    const refresh = () => {
      const historyData = VersionManager.getHistory();
      
      const newNodes = historyData.map((snapshot, index) => {
        const isRestored = snapshot.message.toLowerCase().includes('restore') || snapshot.message.toLowerCase().includes('rollback');
        const xOffset = isRestored ? 350 : 50;
        
        return {
          id: snapshot.id,
          position: { x: xOffset, y: index * 180 + 50 },
          type: 'versionNode',
          data: {
            snapshot,
            index,
            message: snapshot.message,
            timestamp: snapshot.timestamp,
            isLatest: index === historyData.length - 1,
            isRestored,
            onRestore,
            onCompare
          }
        };
      });

      const newEdges = [];
      for (let i = 1; i < historyData.length; i++) {
        newEdges.push({
          id: `e${historyData[i-1].id}-${historyData[i].id}`,
          source: historyData[i-1].id,
          target: historyData[i].id,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#6366f1', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#6366f1',
          },
        });
      }

      setNodes(newNodes);
      setEdges(newEdges);
    };

    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [onRestore, onCompare, setNodes, setEdges]);

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent relative">
      <div className="absolute top-0 left-0 right-0 p-4 border-b border-white/5 bg-black/40 backdrop-blur-xl z-10 flex items-center justify-between shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <GitBranch className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Nova Multiverse</h2>
            <p className="text-[10px] text-slate-400">Visual Time-Travel & Version Graph</p>
          </div>
        </div>
      </div>
      
      <div className="flex-1 w-full h-full relative pt-16">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          className="bg-black/20"
        >
          <Background color="#334155" gap={24} size={2} />
          <Controls className="bg-slate-900 border-slate-800 fill-slate-300 shadow-xl" />
        </ReactFlow>
      </div>
    </div>
  );
}

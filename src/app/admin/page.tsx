"use client";
import React, { useEffect, useState } from 'react';

export interface VerificationItem {
  id?: number;
  user_id?: string;
  address?: string;
  status?: string;
  [key: string]: unknown;
}

export default function HubAdminDashboard() {
  const [queue, setQueue] = useState<VerificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchQueue() {
      try {
        const res = await fetch('/api/hub/address');
        const data = await res.json();
        if (data.success) {
          setQueue(data.data);
        }
      } catch (err) {
        console.error("Failed to fetch queue", err);
      } finally {
        setLoading(false);
      }
    }
    fetchQueue();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
          <h1 className="text-2xl font-bold text-emerald-400">Admin Verification Queue</h1>
          <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm font-bold">{queue.length} Pending</span>
        </div>
        
        {loading ? (
          <div className="text-slate-500 animate-pulse">Loading queue...</div>
        ) : queue.length === 0 ? (
          <div className="text-slate-500 p-8 text-center bg-slate-900 rounded-xl border border-slate-800">Queue is empty.</div>
        ) : (
          <div className="space-y-4">
            {queue.map((item, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex justify-between items-center shadow-lg">
                <div>
                  <h3 className="font-bold text-lg text-slate-200">User ID: {item.user_id || 'Mock-User'}</h3>
                  <p className="text-slate-400 text-sm mt-1 max-w-md">{item.address}</p>
                </div>
                <div className="flex gap-3">
                  <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">Approve</button>
                  <button className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

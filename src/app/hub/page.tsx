"use client";
import React, { useState } from 'react';

export default function HubUserDashboard() {
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Submitting...");
    try {
      const res = await fetch('/api/hub/address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'user-123', address, documentUrl: 'http://example.com/doc.pdf' })
      });
      if (res.ok) {
        setStatus("Address submitted successfully! Pending verification.");
        setAddress("");
      } else {
        setStatus("Submission failed.");
      }
    } catch (_error: unknown) {
      setStatus("Error connecting to server.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 font-sans">
      <div className="max-w-xl mx-auto bg-slate-900 p-8 rounded-xl border border-slate-800 shadow-2xl">
        <h1 className="text-2xl font-bold text-indigo-400 mb-6">Hub Address System</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Full Residential Address</label>
            <textarea 
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-300 outline-none focus:border-indigo-500 h-32 resize-none"
              placeholder="123 Main St, City, Country"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Upload Identity Document</label>
            <input type="file" className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 transition-colors" />
          </div>
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-colors">
            Submit for Verification
          </button>
        </form>
        {status && <div className="mt-4 p-3 bg-slate-800 rounded-lg text-sm text-center text-slate-300">{status}</div>}
      </div>
    </div>
  );
}

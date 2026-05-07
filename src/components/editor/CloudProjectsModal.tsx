import React, { useState, useEffect } from 'react';
import { CloudSyncManager } from '@/lib/storage/cloudSync';
import { Cloud, Download, Trash2, X, Clock, AlertTriangle } from 'lucide-react';

export function CloudProjectsModal({ onClose, onRestore }: { onClose: () => void, onRestore: (projectData: any) => void }) {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    const { success, data, error: fetchErr } = await CloudSyncManager.fetchCloudProjects();
    if (success && data) {
      setProjects(data);
    } else {
      setError(fetchErr || 'Failed to load projects');
    }
    setLoading(false);
  };

  const handleRestore = async (projectId: string) => {
    if (!window.confirm("WARNING: Restoring will overwrite your current local working project in IndexedDB. Are you sure?")) return;
    setLoading(true);
    const { success, data, error: restoreErr } = await CloudSyncManager.restoreFromCloud(projectId);
    setLoading(false);
    
    if (success && data) {
      alert("Project successfully restored from cloud!");
      onRestore(data);
      onClose();
    } else {
      alert(`Restore failed: ${restoreErr}`);
    }
  };

  const handleDelete = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Delete this cloud backup? (This will NOT affect your local copy)")) return;
    setLoading(true);
    const { success, error: delErr } = await CloudSyncManager.deleteCloudBackup(projectId);
    if (success) {
      setProjects(prev => prev.filter(p => p.project_id !== projectId));
    } else {
      alert(`Delete failed: ${delErr}`);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-xl">
          <h2 className="text-lg font-bold flex items-center gap-2 text-white">
            <Cloud className="w-5 h-5 text-blue-400" />
            Cloud Backups
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-md transition-colors text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-800/50 rounded-lg text-red-300 flex items-start gap-2 mb-4 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Cloud className="w-8 h-8 animate-pulse mb-3 opacity-50" />
              <p>Fetching cloud backups...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 text-slate-500 bg-slate-800/30 rounded-lg border border-slate-800 border-dashed">
              <p>No projects found in the cloud.</p>
              <p className="text-sm mt-1 opacity-70">Use "Save to Cloud" in the builder to back up your work.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((proj) => (
                <div key={proj.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-800/50 border border-slate-700 hover:border-blue-500/50 rounded-lg transition-colors group">
                  <div>
                    <h3 className="font-semibold text-white mb-1">{proj.project_name || 'Untitled Project'}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Updated: {new Date(proj.updated_at).toLocaleDateString()} {new Date(proj.updated_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 sm:mt-0">
                    <button 
                      onClick={() => handleRestore(proj.id)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md transition-colors shadow-lg shadow-blue-900/20"
                    >
                      <Download className="w-4 h-4" />
                      Restore
                    </button>
                    <button 
                      onClick={(e) => handleDelete(proj.project_id, e)}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded-md transition-colors"
                      title="Delete Cloud Backup"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { ProjectMemory } from './projectMemory';
import { supabase } from '../supabaseClient';

export interface ProjectSnapshot {
  id: string;
  timestamp: number;
  files: Record<string, string>;
  message: string;
  previewState?: 'pending' | 'running' | 'failed' | 'passed';
}

export class VersionManager {
  private static history: ProjectSnapshot[] = [];
  private static initialized = false;

  private static getProjectId(): string {
    const mem = ProjectMemory.getMemory();
    return mem.project_id || 'default';
  }

  static async init() {
    const projectId = this.getProjectId();
    if (typeof window !== 'undefined') {
      try {
        const { data, error } = await supabase.from('project_versions')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: true });
          
        if (data && !error) {
          this.history = data.map(row => ({
            id: row.id,
            timestamp: new Date(row.created_at).getTime(),
            files: row.snapshot.files,
            message: row.version_name,
            previewState: row.snapshot.previewState
          }));
        } else {
           this.history = [];
        }
      } catch (e) {
        console.error("Failed to init VersionManager from Supabase:", e);
      }
      this.initialized = true;
    }
  }

  static async loadProject(projectId: string) {
    if (typeof window !== 'undefined') {
      const { data } = await supabase.from('project_versions')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: true });
          
      if (data) {
        this.history = data.map(row => ({
          id: row.id,
          timestamp: new Date(row.created_at).getTime(),
          files: row.snapshot.files,
          message: row.version_name,
          previewState: row.snapshot.previewState
        }));
      } else {
        this.history = [];
      }
      this.initialized = true;
    }
  }

  static getHistory(): ProjectSnapshot[] {
    return this.history;
  }

  static saveSnapshot(files: Record<string, string>, message: string, previewState: ProjectSnapshot['previewState'] = 'pending'): ProjectSnapshot {
    const snapshot: ProjectSnapshot = {
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      files,
      message,
      previewState
    };
    
    this.history.push(snapshot);
    const projectId = this.getProjectId();
    
    if (typeof window !== 'undefined') {
      supabase.from('project_versions').insert({
        id: snapshot.id,
        project_id: projectId,
        version_name: message,
        snapshot: { files, previewState },
        created_at: new Date(snapshot.timestamp).toISOString()
      }).then(({error}) => { if (error) console.error(error); });
    }
    
    if (previewState === 'passed') {
      ProjectMemory.markStableVersion(snapshot.id);
    } else if (previewState === 'failed') {
      ProjectMemory.markFailedVersion(snapshot.id, message);
    }
    
    return snapshot;
  }

  static updatePreviewState(id: string, state: ProjectSnapshot['previewState']) {
    const target = this.history.find(s => s.id === id);
    if (target) {
      target.previewState = state;
      const projectId = this.getProjectId();
      if (typeof window !== 'undefined') {
         supabase.from('project_versions').update({
           snapshot: { files: target.files, previewState: state }
         }).eq('id', id).then(({error}) => { if (error) console.error(error); });
      }
      
      if (state === 'passed') {
        ProjectMemory.markStableVersion(id);
      } else if (state === 'failed') {
        ProjectMemory.markFailedVersion(id, "Preview Failed");
      }
    }
  }

  static clearHistory() {
    this.history = [];
  }
}

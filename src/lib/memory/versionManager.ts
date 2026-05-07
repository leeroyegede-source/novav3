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

  static async init() {
    this.history = [];
    this.initialized = true;
  }

  static async loadProject(projectId: string) {
    if (typeof window !== 'undefined') {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session?.user) {
           this.history = [];
           this.initialized = true;
           return;
        }

        const { data, error } = await supabase
          .from('project_versions')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          this.history = data.map(v => ({
             id: v.id,
             timestamp: new Date(v.created_at || Date.now()).getTime(),
             files: v.files,
             message: v.message,
             previewState: v.preview_state
          }));
        } else {
          this.history = [];
        }
      } catch (e) {
        console.error("Failed to load versions from Supabase", e);
        this.history = [];
      }
      this.initialized = true;
    }
  }

  static getHistory(): ProjectSnapshot[] {
    return this.history;
  }

  static saveSnapshot(files: Record<string, string>, message: string, previewState: ProjectSnapshot['previewState'] = 'pending'): ProjectSnapshot {
    const mem = ProjectMemory.getMemory();
    const projectId = mem.project_id;
    
    const snapshot: ProjectSnapshot = {
      id: ProjectMemory.generateUUID(),
      timestamp: Date.now(),
      files,
      message,
      previewState
    };
    
    this.history.push(snapshot);
    
    if (typeof window !== 'undefined') {
      supabase.auth.getSession().then(({ data }) => {
        if (data?.session?.user && projectId) {
           (async () => {
             await supabase.from('project_versions').insert({
                id: snapshot.id,
                project_id: projectId,
                files: snapshot.files,
                message: snapshot.message,
                preview_state: snapshot.previewState
             });
           })();
        }
      });
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
      
      if (typeof window !== 'undefined') {
        supabase.auth.getSession().then(({ data }) => {
          if (data?.session?.user) {
             (async () => {
               await supabase.from('project_versions')
                 .update({ preview_state: state })
                 .eq('id', id);
             })();
          }
        });
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

  static restoreHistory(historyData: ProjectSnapshot[]) {
    this.history = historyData;
  }
}

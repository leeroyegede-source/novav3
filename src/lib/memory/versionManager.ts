import { ProjectMemory } from './projectMemory';
import { LocalDB, STORE_VERSIONS } from '../storage/indexedDB';

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

  private static getStorageKey(): string {
    const mem = ProjectMemory.getMemory();
    return mem.project_id ? `nova_versions_${mem.project_id}` : 'nova_versions';
  }

  static async init() {
    const key = this.getStorageKey();
    if (typeof window !== 'undefined') {
      try {
        const idbData = await LocalDB.get<ProjectSnapshot[]>(STORE_VERSIONS, key);
        if (idbData) {
          this.history = idbData;
        } else {
          // Backward compatibility check for old global key
          const oldData = localStorage.getItem('nova_versions');
          if (oldData && key === 'nova_versions_default') {
             this.history = JSON.parse(oldData);
             await LocalDB.set(STORE_VERSIONS, key, this.history);
          } else {
             const lsData = localStorage.getItem(key);
             if (lsData) {
               this.history = JSON.parse(lsData);
               await LocalDB.set(STORE_VERSIONS, key, this.history);
             } else {
               this.history = [];
             }
          }
        }
      } catch (e) {
        console.error("Failed to init VersionManager from IDB:", e);
      }
      this.initialized = true;
    }
  }

  static async loadProject(projectId: string) {
    const key = `nova_versions_${projectId}`;
    if (typeof window !== 'undefined') {
      const idbData = await LocalDB.get<ProjectSnapshot[]>(STORE_VERSIONS, key);
      this.history = idbData || [];
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
    const key = this.getStorageKey();
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(this.history));
      LocalDB.set(STORE_VERSIONS, key, this.history).catch(console.error);
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
      const key = this.getStorageKey();
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(this.history));
        LocalDB.set(STORE_VERSIONS, key, this.history).catch(console.error);
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
    const key = this.getStorageKey();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
      LocalDB.remove(STORE_VERSIONS, key).catch(console.error);
    }
  }
}

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
  private static STORAGE_KEY = 'nova_versions';
  private static history: ProjectSnapshot[] = [];
  private static initialized = false;

  static async init() {
    if (this.initialized) return;
    if (typeof window !== 'undefined') {
      try {
        const idbData = await LocalDB.get<ProjectSnapshot[]>(STORE_VERSIONS, this.STORAGE_KEY);
        if (idbData) {
          this.history = idbData;
        } else {
          const lsData = localStorage.getItem(this.STORAGE_KEY);
          if (lsData) {
            this.history = JSON.parse(lsData);
            await LocalDB.set(STORE_VERSIONS, this.STORAGE_KEY, this.history);
          }
        }
      } catch (e) {
        console.error("Failed to init VersionManager from IDB:", e);
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
    if (typeof window !== 'undefined') {
      // Temporarily Dual-Write
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.history));
      LocalDB.set(STORE_VERSIONS, this.STORAGE_KEY, this.history).catch(console.error);
    }
    
    // Auto-update stable version if state is passed
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
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.history));
        LocalDB.set(STORE_VERSIONS, this.STORAGE_KEY, this.history).catch(console.error);
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
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY);
      LocalDB.remove(STORE_VERSIONS, this.STORAGE_KEY).catch(console.error);
    }
  }
}

import { LocalDB, STORE_MEMORY } from '../storage/indexedDB';

export interface MemoryItem {
  id: string;
  type: 'route' | 'component' | 'api' | 'database' | 'tool' | 'env' | 'error' | 'fix' | 'user_instruction' | 'design' | 'deployment' | 'todo';
  title: string;
  content: string;
  source_file?: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
  created_at: number;
}

export interface ProjectMemoryState {
  project_id: string;
  project_mode: string;
  framework: string;
  memory_summary: string;
  last_stable_version_id?: string;
  last_failed_version_id?: string;
  items: MemoryItem[];
  updated_at: number;
}

export class ProjectMemory {
  private static STORAGE_KEY = 'nova_project_memory';
  private static state: ProjectMemoryState | null = null;
  private static initialized = false;

  static async init() {
    if (this.initialized) return;
    if (typeof window !== 'undefined') {
      try {
        const idbData = await LocalDB.get<ProjectMemoryState>(STORE_MEMORY, this.STORAGE_KEY);
        if (idbData) {
          this.state = idbData;
        } else {
          const lsData = localStorage.getItem(this.STORAGE_KEY);
          if (lsData) {
            this.state = JSON.parse(lsData);
            await LocalDB.set(STORE_MEMORY, this.STORAGE_KEY, this.state);
          }
        }
      } catch (e) {
        console.error("Failed to init ProjectMemory from IDB:", e);
      }
      this.initialized = true;
    }
  }

  static getMemory(): ProjectMemoryState {
    if (this.state) return this.state;
    
    // Fallback if not initialized yet
    return {
      project_id: 'default',
      project_mode: 'Auto Detect',
      framework: 'Unknown',
      memory_summary: 'New Project',
      items: [],
      updated_at: Date.now()
    };
  }

  static saveMemory(state: ProjectMemoryState) {
    state.updated_at = Date.now();
    this.state = state;
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
      LocalDB.set(STORE_MEMORY, this.STORAGE_KEY, state).catch(console.error);
    }
  }

  static addItem(item: Omit<MemoryItem, 'id' | 'created_at'>) {
    const state = this.getMemory();
    state.items.push({
      ...item,
      id: Math.random().toString(36).substring(7),
      created_at: Date.now()
    });
    this.saveMemory(state);
  }

  static updateSummary(summary: string) {
    const state = this.getMemory();
    state.memory_summary = summary;
    this.saveMemory(state);
  }

  static markStableVersion(versionId: string) {
    const state = this.getMemory();
    state.last_stable_version_id = versionId;
    this.saveMemory(state);
  }

  static markFailedVersion(versionId: string, errorMsg: string) {
    const state = this.getMemory();
    state.last_failed_version_id = versionId;
    this.addItem({
      type: 'error',
      title: 'Build/Runtime Failure',
      content: errorMsg,
      importance: 'critical'
    });
    this.saveMemory(state);
  }

  static clearFailedItems() {
    const state = this.getMemory();
    state.items = state.items.filter(i => i.type !== 'error');
    this.saveMemory(state);
  }
}

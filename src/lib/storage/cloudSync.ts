import { supabase } from '@/lib/supabaseClient';
import { LocalDB, STORE_FILES, STORE_CHAT } from './indexedDB';
import { ProjectMemory } from '../memory/projectMemory';
import { VersionManager } from '../memory/versionManager';

export interface SyncStatus {
  status: 'idle' | 'saving' | 'synced' | 'error';
  message: string;
}

export class CloudSyncManager {
  
  static async logDebug(action: string, table: string, projectId: string, userId: string, success: boolean, errorDetail?: any) {
    if (typeof window === 'undefined') return;
    const logs = JSON.parse(localStorage.getItem('nova_debug_logs') || '[]');
    logs.unshift({
      time: new Date().toISOString(),
      action,
      table,
      projectId,
      userId,
      success,
      errorDetail: errorDetail ? (typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : String(errorDetail)) : null
    });
    // Keep last 20
    if (logs.length > 20) logs.length = 20;
    localStorage.setItem('nova_debug_logs', JSON.stringify(logs));
    window.dispatchEvent(new CustomEvent('nova-debug-updated'));
  }

  static async fetchCloudProjects() {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) return { success: false, error: 'User not authenticated' };

    try {
      const { data, error } = await supabase
        .from('cloud_project_backups')
        .select('id, project_id, project_name, created_at, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      await this.logDebug('fetch_projects', 'cloud_project_backups', 'all', user.id, true);
      return { success: true, data };
    } catch (err: any) {
      await this.logDebug('fetch_projects', 'cloud_project_backups', 'all', user.id, false, err);
      return { success: false, error: err.message };
    }
  }

  static async saveToCloud(projectId: string, files: Record<string, string>, activeProjectName: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) return { success: false, error: 'User not authenticated' };

    try {
      const memory = ProjectMemory.getMemory();
      const versions = VersionManager.getHistory();
      
      // Fetch Chat
      const chatMessages = await LocalDB.get(STORE_CHAT, 'nova_messages') || [];
      const chatHistory = await LocalDB.get(STORE_CHAT, 'nova_history') || [];

      // Filter out massive junk files
      const cleanFiles: Record<string, string> = {};
      for (const [path, content] of Object.entries(files)) {
        if (!path.includes('/node_modules/') && !path.includes('/.next/') && !path.includes('/dist/')) {
          cleanFiles[path] = content;
        }
      }

      const snapshot = {
        project: { id: projectId, name: activeProjectName },
        workspace: {
          framework: memory.framework || 'React',
          active_mode: memory.project_mode || 'Auto Detect',
        },
        files: cleanFiles,
        chat: { messages: chatMessages, history: chatHistory },
        memory,
        versions,
        settings: {},
        savedAt: new Date().toISOString()
      };

      const { error: upsertErr } = await supabase
        .from('cloud_project_backups')
        .upsert({
          user_id: user.id,
          project_id: projectId,
          project_name: activeProjectName || "Untitled Project",
          snapshot,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "user_id,project_id"
        });

      if (upsertErr) throw upsertErr;

      await this.logDebug('save_project', 'cloud_project_backups', projectId, user.id, true);
      return { success: true };
    } catch (err: any) {
      await this.logDebug('save_project', 'cloud_project_backups', projectId, user.id, false, err);
      return { success: false, error: err.message || 'Failed to save to cloud' };
    }
  }

  static async restoreFromCloud(backupId: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) return { success: false, error: 'User not authenticated' };

    try {
      const { data, error } = await supabase
        .from('cloud_project_backups')
        .select('*')
        .eq('id', backupId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      
      const snapshot = data.snapshot;
      if (!snapshot) throw new Error("Snapshot data is empty or corrupted.");

      const projectId = snapshot.project?.id || data.project_id;
      
      // Restore Files to IndexedDB
      if (snapshot.files) {
         await LocalDB.set(STORE_FILES, projectId, snapshot.files);
      }
      
      // Restore Memory
      if (snapshot.memory) {
        ProjectMemory.saveMemory(snapshot.memory);
      }
      
      // Restore Versions
      if (snapshot.versions) {
        VersionManager.restoreHistory(snapshot.versions);
      }

      // Restore Chat
      if (snapshot.chat) {
         if (snapshot.chat.messages) await LocalDB.set(STORE_CHAT, 'nova_messages', snapshot.chat.messages);
         if (snapshot.chat.history) await LocalDB.set(STORE_CHAT, 'nova_history', snapshot.chat.history);
      }

      await this.logDebug('restore_project', 'cloud_project_backups', projectId, user.id, true);
      
      return { 
        success: true, 
        data: {
          project: snapshot.project || { id: data.project_id, name: data.project_name },
          files: snapshot.files || {},
          workspace: snapshot.workspace || {}
        }
      };
    } catch (err: any) {
      const projIdFromErr = "unknown";
      await this.logDebug('restore_project', 'cloud_project_backups', projIdFromErr, user.id, false, err);
      return { success: false, error: err.message || 'Failed to restore from cloud' };
    }
  }

  static async deleteCloudBackup(projectId: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) return { success: false, error: 'User not authenticated' };

    try {
      // Using project_id for deletion instead of the row uuid 'id' 
      // since the BuilderLayout calls deleteCloudBackup(projId) where projId is project_id
      const { error: delErr } = await supabase
        .from('cloud_project_backups')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', user.id);

      if (delErr) throw delErr;

      await this.logDebug('delete_cloud', 'cloud_project_backups', projectId, user.id, true);
      return { success: true };
    } catch (err: any) {
      await this.logDebug('delete_cloud', 'cloud_project_backups', projectId, user.id, false, err);
      return { success: false, error: err.message || 'Failed to delete cloud backup' };
    }
  }
}

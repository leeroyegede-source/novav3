export const DB_NAME = 'NovaAILocalDB';
export const DB_VERSION = 1;

export const STORE_FILES = 'project_files';
export const STORE_VERSIONS = 'project_versions';
export const STORE_MEMORY = 'project_memory';
export const STORE_CHAT = 'project_chat';

const STORES = [STORE_FILES, STORE_VERSIONS, STORE_MEMORY, STORE_CHAT];

export class LocalDB {
  private static db: IDBDatabase | null = null;

  static async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    
    if (typeof window === 'undefined') {
       throw new Error('IndexedDB is only available in the browser.');
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        STORES.forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName);
          }
        });
      };

      request.onsuccess = (event: Event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event: Event) => {
        console.error('IndexedDB init error:', event);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  static async get<T>(storeName: string, key: string): Promise<T | null> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result as T | null);
      request.onerror = () => reject(request.error);
    });
  }

  static async set(storeName: string, key: string, value: any): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  static async remove(storeName: string, key: string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

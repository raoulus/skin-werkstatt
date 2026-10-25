// Lokale Galerie in IndexedDB: bleibt im Browser des Geräts, ganz ohne Server.

export interface StoredSkin {
  id: string;
  name: string;
  png: string; // data:-URL
  thumb: string; // data:-URL der 3D-Vorschau
  slim: boolean;
  tags: string[];
  created: number;
  updated: number;
  /** Gesetzt, wenn der Skin in der Galerie für alle eingereicht wurde. */
  serverId?: string;
}

const DB_NAME = 'skin-werkstatt';
const STORE = 'skins';

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listSkins(): Promise<StoredSkin[]> {
  const all = await run<StoredSkin[]>('readonly', (s) => s.getAll());
  return all.sort((a, b) => b.updated - a.updated);
}

export const getSkin = (id: string) => run<StoredSkin | undefined>('readonly', (s) => s.get(id));
export const putSkin = (skin: StoredSkin) => run('readwrite', (s) => s.put(skin));
export const deleteSkin = (id: string) => run('readwrite', (s) => s.delete(id));

export function newId(): string {
  const b = crypto.getRandomValues(new Uint8Array(8));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

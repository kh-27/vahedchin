/** FR-44: scenarios live in the browser's IndexedDB; nothing is sent anywhere (NFR-04). */

import { normalizeState, type AppState } from "../app/scenario";

const DB = "vahedchin";
const STORE = "state";
const KEY = "app";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, f: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = f(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

export async function loadState(): Promise<AppState | null> {
  return normalizeState(await run<unknown>("readonly", (s) => s.get(KEY)));
}

export async function saveState(state: AppState): Promise<void> {
  await run("readwrite", (s) => s.put(state, KEY));
}

/** Ask the browser not to evict our data (risk: cleared browser storage). */
export async function persist(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

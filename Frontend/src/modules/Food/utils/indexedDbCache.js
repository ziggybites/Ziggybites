/**
 * Tiny IndexedDB cache for public read-heavy responses.
 */

const DB_NAME = 'ziggybites-cache';
const DB_VERSION = 1;
const DEFAULT_STORE = 'publicResponses';
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);

  dbPromise = new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DEFAULT_STORE)) {
        db.createObjectStore(DEFAULT_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });

  return dbPromise;
}

async function withStore(storeName, mode, handler) {
  const db = await openDb();
  if (!db) return null;

  if (!db.objectStoreNames.contains(storeName) && mode === 'readwrite') {
    db.close();
    dbPromise = null;
    const reopened = await openDb();
    if (!reopened || !reopened.objectStoreNames.contains(storeName)) return null;
  }

  return new Promise((resolve) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = handler(store);
    tx.oncomplete = () => resolve(result?.result ?? result ?? null);
    tx.onerror = () => resolve(null);
  });
}

export async function getCachedEntry(storeName = DEFAULT_STORE, key, maxAgeMs = 0) {
  if (!key) return null;
  const db = await openDb();
  if (!db || !db.objectStoreNames.contains(storeName)) return null;

  return new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => {
      const entry = request.result;
      if (!entry) {
        resolve(null);
        return;
      }
      if (maxAgeMs > 0 && Date.now() - Number(entry.updatedAt || 0) > maxAgeMs) {
        resolve(null);
        return;
      }
      resolve(entry);
    };
    request.onerror = () => resolve(null);
  });
}

export async function setCachedEntry(storeName = DEFAULT_STORE, key, value) {
  if (!key) return;
  const db = await openDb();
  if (!db) return;

  if (!db.objectStoreNames.contains(storeName)) {
    db.close();
    dbPromise = null;
    return;
  }

  await withStore(storeName, 'readwrite', (store) => store.put({ key, value, updatedAt: Date.now() }));
}

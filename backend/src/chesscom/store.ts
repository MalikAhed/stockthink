/**
 * Analyzed-report cache: pre-analyzed chess.com games open instantly and
 * survive reloads. IndexedDB is best-effort — when it is unavailable
 * (private mode, tests) an in-memory map takes over and the cache simply
 * lives for the session. Reports are plain JSON (MoveReport carries no
 * Maps/functions), so they round-trip structured-clone unchanged.
 */
import type { AnnotatedReport, Tier } from '../analyze';

const DB_NAME = 'stockthink';
const STORE = 'reports';
/** Oldest reports are evicted past this count (~300 KB each → tens of MB max). */
const MAX_REPORTS = 60;

interface CachedReport {
  key: string;
  savedAt: number;
  report: AnnotatedReport;
}

export const reportKey = (uuid: string, tier: Tier): string => `${uuid}:${tier}`;

const memory = new Map<string, CachedReport>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('savedAt', 'savedAt');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

/** Run one request inside a transaction; null on any failure (cache is optional). */
function request<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return new Promise(resolve => {
    try {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function getReport(uuid: string, tier: Tier): Promise<AnnotatedReport | null> {
  const key = reportKey(uuid, tier);
  const db = await openDb();
  if (!db) return memory.get(key)?.report ?? null;
  const row = await request<CachedReport | undefined>(db, 'readonly', s => s.get(key));
  return row?.report ?? null;
}

export async function putReport(uuid: string, tier: Tier, report: AnnotatedReport): Promise<void> {
  const row: CachedReport = { key: reportKey(uuid, tier), savedAt: Date.now(), report };
  const db = await openDb();
  if (!db) {
    memory.set(row.key, row);
    pruneMemory();
    return;
  }
  await request(db, 'readwrite', s => s.put(row));
  await pruneDb(db);
}

/** Keys of every cached report — drives the "Analyzed" chips in the list. */
export async function cachedKeys(): Promise<Set<string>> {
  const db = await openDb();
  if (!db) return new Set(memory.keys());
  const keys = await request<IDBValidKey[]>(db, 'readonly', s => s.getAllKeys());
  return new Set((keys ?? []).map(String));
}

function pruneMemory(): void {
  while (memory.size > MAX_REPORTS) {
    let oldest: string | null = null;
    let at = Infinity;
    for (const [k, v] of memory) if (v.savedAt < at) ((at = v.savedAt), (oldest = k));
    if (!oldest) return;
    memory.delete(oldest);
  }
}

function pruneDb(db: IDBDatabase): Promise<void> {
  return new Promise(resolve => {
    try {
      const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
      const count = store.count();
      count.onsuccess = () => {
        let excess = count.result - MAX_REPORTS;
        if (excess <= 0) return resolve();
        const cursor = store.index('savedAt').openCursor();
        cursor.onsuccess = () => {
          const c = cursor.result;
          if (!c || excess-- <= 0) return resolve();
          c.delete();
          c.continue();
        };
        cursor.onerror = () => resolve();
      };
      count.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

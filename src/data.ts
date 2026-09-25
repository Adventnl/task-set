export interface Capture {
  id: string;
  kind: 'text' | 'voice';
  text: string;
  createdAt: string;
  audio?: Blob;
  mimeType?: string;
  aiStatus?: 'saved' | 'ready' | 'needs-retry';
}

export interface Task {
  id: string;
  captureId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  dueAt: string | null;
  reminderAt: string | null;
  pinned: boolean;
  completedAt: string | null;
  suggestionStatus?: 'suggested' | 'dismissed' | null;
}

const DATABASE_NAME = 'task-set';
const DATABASE_VERSION = 1;
const CAPTURES_STORE = 'captures';
const TASKS_STORE = 'tasks';

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is unavailable in this browser.'));
  }

  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(CAPTURES_STORE)) {
          database.createObjectStore(CAPTURES_STORE, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(TASKS_STORE)) {
          database.createObjectStore(TASKS_STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          databasePromise = null;
        };
        resolve(database);
      };

      request.onerror = () => reject(request.error ?? new Error('Could not open local data.'));
    }).catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Local data transaction was aborted.'));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('Local data transaction failed.'));
  });
}

function byCreatedAt<T extends { id: string; createdAt: string }>(a: T, b: T): number {
  const aTime = Date.parse(a.createdAt);
  const bTime = Date.parse(b.createdAt);
  if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
    return aTime - bTime;
  }
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

export async function loadData(): Promise<{ captures: Capture[]; tasks: Task[] }> {
  const database = await openDatabase();
  const transaction = database.transaction([CAPTURES_STORE, TASKS_STORE], 'readonly');
  const capturesRequest = transaction.objectStore(CAPTURES_STORE).getAll();
  const tasksRequest = transaction.objectStore(TASKS_STORE).getAll();
  await transactionComplete(transaction);

  return {
    captures: (capturesRequest.result as Capture[]).sort(byCreatedAt),
    tasks: (tasksRequest.result as Task[]).sort(byCreatedAt),
  };
}

export async function saveCapture(capture: Capture): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(CAPTURES_STORE, 'readwrite');
  transaction.objectStore(CAPTURES_STORE).put(capture);
  await transactionComplete(transaction);
}

export async function saveTranscriptAndDismissDrafts(capture: Capture, drafts: Task[]): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction([CAPTURES_STORE, TASKS_STORE], 'readwrite');
  transaction.objectStore(CAPTURES_STORE).put(capture);
  const taskStore = transaction.objectStore(TASKS_STORE);
  for (const draft of drafts) taskStore.put({ ...draft, suggestionStatus: 'dismissed' });
  await transactionComplete(transaction);
}

export async function saveTask(task: Task): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(TASKS_STORE, 'readwrite');
  transaction.objectStore(TASKS_STORE).put(task);
  await transactionComplete(transaction);
}

export async function deleteTask(id: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(TASKS_STORE, 'readwrite');
  transaction.objectStore(TASKS_STORE).delete(id);
  await transactionComplete(transaction);
}

export function createId(): string {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('Secure random IDs are unavailable in this browser.');
  }
  return globalThis.crypto.randomUUID();
}

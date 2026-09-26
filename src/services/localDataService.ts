import type { SyncRecord } from '../shared/types/sync'
import type { Capture, Task } from '../shared/types/task'
import { recordKey } from '../shared/utils/records'

const DATABASE_NAME = 'task-set'
const DATABASE_VERSION = 2
const CAPTURES = 'captures'
const TASKS = 'tasks'
const OUTBOX = 'outbox'
const META = 'meta'
const CURSOR_KEY = 'cursor'

/** A local change waiting to reach the server. `rev` detects edits made while a push is in flight. */
export interface OutboxEntry {
  key: string
  rev: string
  record: SyncRecord
}

let databasePromise: Promise<IDBDatabase> | null = null

/** Version 1 stored audio and optional fields; keep the text and queue it for the first sync. */
function migrateFromV1(transaction: IDBTransaction): void {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const outbox = transaction.objectStore(OUTBOX)
  const queue = (record: SyncRecord) => outbox.put({ key: recordKey(record), rev: 'migrated', record })
  transaction.objectStore(CAPTURES).openCursor().onsuccess = (event) => {
    const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
    if (!cursor) return
    const old = cursor.value as Capture & { audio?: Blob; mimeType?: string }
    if (!old.text?.trim()) {
      cursor.delete() // an untranscribed recording has no text left once audio is not kept
    } else {
      const value: Capture = {
        id: old.id,
        kind: old.kind,
        text: old.text,
        timeZone,
        createdAt: old.createdAt,
        updatedAt: old.createdAt,
        deletedAt: null,
        ai: null,
      }
      cursor.update(value)
      queue({ type: 'capture', value })
    }
    cursor.continue()
  }
  transaction.objectStore(TASKS).openCursor().onsuccess = (event) => {
    const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
    if (!cursor) return
    const old = cursor.value as Task
    const value: Task = { ...old, deletedAt: null, suggestionStatus: old.suggestionStatus ?? null }
    cursor.update(value)
    queue({ type: 'task', value })
    cursor.continue()
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is unavailable in this browser.'))
  databasePromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = (event) => {
      const database = request.result
      for (const name of [CAPTURES, TASKS]) {
        if (!database.objectStoreNames.contains(name)) database.createObjectStore(name, { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains(OUTBOX)) database.createObjectStore(OUTBOX, { keyPath: 'key' })
      if (!database.objectStoreNames.contains(META)) database.createObjectStore(META)
      if (event.oldVersion === 1 && request.transaction) migrateFromV1(request.transaction)
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => {
        database.close()
        databasePromise = null
      }
      resolve(database)
    }
    request.onerror = () => reject(request.error ?? new Error('Could not open local data.'))
  }).catch((error: unknown) => {
    databasePromise = null
    throw error
  })
  return databasePromise
}

function complete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('Local data transaction was aborted.'))
    transaction.onerror = () => reject(transaction.error ?? new Error('Local data transaction failed.'))
  })
}

function storeFor(record: SyncRecord): string {
  return record.type === 'capture' ? CAPTURES : TASKS
}

export async function loadData(): Promise<{ captures: Capture[]; tasks: Task[] }> {
  const database = await openDatabase()
  const transaction = database.transaction([CAPTURES, TASKS], 'readonly')
  const captures = transaction.objectStore(CAPTURES).getAll()
  const tasks = transaction.objectStore(TASKS).getAll()
  await complete(transaction)
  const byCreatedAt = (a: Capture | Task, b: Capture | Task) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
  return {
    captures: (captures.result as Capture[]).filter((item) => !item.deletedAt).sort(byCreatedAt),
    tasks: (tasks.result as Task[]).filter((item) => !item.deletedAt).sort(byCreatedAt),
  }
}

/** Saves local edits and queues them for sync in one transaction, so neither can happen alone. */
export async function saveLocal(records: SyncRecord[]): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction([CAPTURES, TASKS, OUTBOX], 'readwrite')
  for (const record of records) {
    const store = transaction.objectStore(storeFor(record))
    if (record.value.deletedAt) store.delete(record.value.id)
    else store.put(record.value)
    transaction.objectStore(OUTBOX).put({ key: recordKey(record), rev: crypto.randomUUID(), record } satisfies OutboxEntry)
  }
  await complete(transaction)
}

export async function readOutbox(limit: number): Promise<OutboxEntry[]> {
  const database = await openDatabase()
  const transaction = database.transaction(OUTBOX, 'readonly')
  const request = transaction.objectStore(OUTBOX).getAll(null, limit)
  await complete(transaction)
  return request.result as OutboxEntry[]
}

/** Removes pushed entries unless they were edited again while the push was in flight. */
export async function acknowledgeOutbox(entries: OutboxEntry[]): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(OUTBOX, 'readwrite')
  const store = transaction.objectStore(OUTBOX)
  for (const entry of entries) {
    const current = store.get(entry.key)
    current.onsuccess = () => {
      if ((current.result as OutboxEntry | undefined)?.rev === entry.rev) store.delete(entry.key)
    }
  }
  await complete(transaction)
}

/**
 * Applies server records. A record with an unsent local edit is skipped; the server's answer
 * to that edit arrives on the next pull. Returns the records that were applied.
 */
export async function applyRemote(records: SyncRecord[], cursor: number): Promise<SyncRecord[]> {
  const database = await openDatabase()
  const transaction = database.transaction([CAPTURES, TASKS, OUTBOX, META], 'readwrite')
  const applied: SyncRecord[] = []
  const pendingRequest = transaction.objectStore(OUTBOX).getAllKeys()
  pendingRequest.onsuccess = () => {
    const pending = new Set(pendingRequest.result as string[])
    for (const record of records) {
      if (pending.has(recordKey(record))) continue
      applied.push(record)
      const store = transaction.objectStore(storeFor(record))
      if (record.value.deletedAt) store.delete(record.value.id)
      else store.put(record.value)
    }
  }
  transaction.objectStore(META).put(cursor, CURSOR_KEY)
  await complete(transaction)
  return applied
}

export async function readCursor(): Promise<number> {
  const database = await openDatabase()
  const transaction = database.transaction(META, 'readonly')
  const request = transaction.objectStore(META).get(CURSOR_KEY)
  await complete(transaction)
  return typeof request.result === 'number' ? request.result : 0
}

export async function countOutbox(): Promise<number> {
  const database = await openDatabase()
  const transaction = database.transaction(OUTBOX, 'readonly')
  const request = transaction.objectStore(OUTBOX).count()
  await complete(transaction)
  return request.result
}

/** Removes every local record, queued change, and sync cursor from this browser. */
export async function clearLocalData(): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction([CAPTURES, TASKS, OUTBOX, META], 'readwrite')
  for (const name of [CAPTURES, TASKS, OUTBOX, META]) transaction.objectStore(name).clear()
  await complete(transaction)
}

export function createId(): string {
  if (typeof globalThis.crypto?.randomUUID !== 'function') throw new Error('Secure random IDs are unavailable in this browser.')
  return globalThis.crypto.randomUUID()
}

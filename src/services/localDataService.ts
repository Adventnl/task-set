import type { CalendarEvent } from '../shared/types/calendar'
import type { Meeting, MeetingNote } from '../shared/types/meeting'
import type { SyncRecord, WorkspaceData } from '../shared/types/sync'
import type { Capture, Task } from '../shared/types/task'
import { byCreatedAt, recordKey } from '../shared/utils/records'

const DATABASE_NAME = 'task-set'
const DATABASE_VERSION = 3
const CAPTURES = 'captures'
const TASKS = 'tasks'
const OUTBOX = 'outbox'
const META = 'meta'
const CURSOR_KEY = 'cursor'

/** One object store per record type, named after its list in `WorkspaceData`. */
const STORES = {
  capture: CAPTURES,
  task: TASKS,
  event: 'events',
  meeting: 'meetings',
  meetingNote: 'meetingNotes',
} as const satisfies Record<SyncRecord['type'], keyof WorkspaceData>
const RECORD_STORES = Object.values(STORES)

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
      for (const name of RECORD_STORES) {
        if (!database.objectStoreNames.contains(name)) database.createObjectStore(name, { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains(OUTBOX)) database.createObjectStore(OUTBOX, { keyPath: 'key' })
      if (!database.objectStoreNames.contains(META)) database.createObjectStore(META)
      if (!request.transaction) return
      if (event.oldVersion === 1) migrateFromV1(request.transaction)
      // An older app skipped record types it did not know yet; pulling from the start fetches them.
      if (event.oldVersion > 0) request.transaction.objectStore(META).delete(CURSOR_KEY)
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
  return STORES[record.type]
}

export async function loadData(): Promise<WorkspaceData> {
  const database = await openDatabase()
  const transaction = database.transaction(RECORD_STORES, 'readonly')
  // Each list is read once the transaction completes; deletions never reach the screen.
  const read = <T extends Capture | Task | CalendarEvent | Meeting | MeetingNote>(name: string) => {
    const request = transaction.objectStore(name).getAll()
    return () => (request.result as T[]).filter((item) => !item.deletedAt).sort(byCreatedAt)
  }
  const captures = read<Capture>(STORES.capture)
  const tasks = read<Task>(STORES.task)
  const events = read<CalendarEvent>(STORES.event)
  const meetings = read<Meeting>(STORES.meeting)
  const meetingNotes = read<MeetingNote>(STORES.meetingNote)
  await complete(transaction)
  return { captures: captures(), tasks: tasks(), events: events(), meetings: meetings(), meetingNotes: meetingNotes() }
}

/**
 * Saves local edits and queues them for sync in one transaction, so neither can happen alone.
 * Returns the records, so an operation can save and hand them on in one step.
 */
export async function saveLocal(records: SyncRecord[]): Promise<SyncRecord[]> {
  const database = await openDatabase()
  const transaction = database.transaction([...RECORD_STORES, OUTBOX], 'readwrite')
  for (const record of records) {
    const store = transaction.objectStore(storeFor(record))
    if (record.value.deletedAt) store.delete(record.value.id)
    else store.put(record.value)
    transaction.objectStore(OUTBOX).put({ key: recordKey(record), rev: crypto.randomUUID(), record } satisfies OutboxEntry)
  }
  await complete(transaction)
  return records
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
  const transaction = database.transaction([...RECORD_STORES, OUTBOX, META], 'readwrite')
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
  const stores = [...RECORD_STORES, OUTBOX, META]
  const transaction = database.transaction(stores, 'readwrite')
  for (const name of stores) transaction.objectStore(name).clear()
  await complete(transaction)
}

export function createId(): string {
  if (typeof globalThis.crypto?.randomUUID !== 'function') throw new Error('Secure random IDs are unavailable in this browser.')
  return globalThis.crypto.randomUUID()
}

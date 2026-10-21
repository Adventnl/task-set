import { IDBFactory } from 'fake-indexeddb'
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Creates the version 2 database the previous release used, with a sync cursor already saved. */
function openVersion2(cursor: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('task-set', 2)
    request.onupgradeneeded = () => {
      const database = request.result
      database.createObjectStore('captures', { keyPath: 'id' })
      database.createObjectStore('tasks', { keyPath: 'id' })
      database.createObjectStore('outbox', { keyPath: 'key' })
      database.createObjectStore('meta')
    }
    request.onsuccess = () => {
      const database = request.result
      const transaction = database.transaction('meta', 'readwrite')
      transaction.objectStore('meta').put(cursor, 'cursor')
      transaction.oncomplete = () => {
        database.close()
        resolve()
      }
    }
    request.onerror = () => reject(request.error)
  })
}

describe('local database upgrade', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory())
    vi.resetModules() // a fresh module opens the database again
  })
  afterEach(() => vi.unstubAllGlobals())

  it('adds calendar and meeting stores and pulls everything again, since an older app skipped those records', async () => {
    await openVersion2(42)
    const local = await import('../src/services/localDataService')
    expect(await local.readCursor()).toBe(0)
    expect(await local.loadData()).toEqual({ checklists: [], checklistItems: [], captures: [], tasks: [], events: [], meetings: [], meetingNotes: [], mapCategories: [], mapPins: [] })
  })

  it('upgrades version 4 for Lists, keeping existing records and pending changes and resetting the pull cursor', async () => {
    const task = { id: 'task-kept', captureId: null, title: 'Keep me', createdAt: '2026-10-20T00:00:00.000Z', updatedAt: '2026-10-20T00:00:00.000Z', deletedAt: null, dueAt: null, reminderAt: null, pinned: false, completedAt: null, suggestionStatus: null }
    const queued = { key: 'task:task-kept', rev: 'unsent-edit', record: { type: 'task', value: task } }
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('task-set', 4)
      request.onupgradeneeded = () => {
        for (const name of ['captures', 'tasks', 'events', 'meetings', 'meetingNotes', 'mapCategories', 'mapPins']) request.result.createObjectStore(name, { keyPath: 'id' })
        request.result.createObjectStore('outbox', { keyPath: 'key' })
        request.result.createObjectStore('meta')
      }
      request.onsuccess = () => {
        const database = request.result
        const transaction = database.transaction(['tasks', 'outbox', 'meta'], 'readwrite')
        transaction.objectStore('tasks').put(task)
        transaction.objectStore('outbox').put(queued)
        transaction.objectStore('meta').put(99, 'cursor')
        transaction.oncomplete = () => { database.close(); resolve() }
        transaction.onerror = () => reject(transaction.error)
      }
      request.onerror = () => reject(request.error)
    })
    const local = await import('../src/services/localDataService')
    expect(await local.readCursor()).toBe(0)
    expect(await local.readOutbox(10)).toEqual([queued])
    expect(await local.loadData()).toMatchObject({ tasks: [task], checklists: [], checklistItems: [] })
  })
})

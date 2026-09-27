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
    expect(await local.loadData()).toEqual({ captures: [], tasks: [], events: [], meetings: [], meetingNotes: [] })
  })
})

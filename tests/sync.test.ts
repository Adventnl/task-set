import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pullRecords, pushRecords } from '../src/connectors/syncConnector'
import { acknowledgeOutbox, applyRemote, clearLocalData, loadData, readCursor, readOutbox, saveLocal } from '../src/services/localDataService'
import { requestSync } from '../src/services/syncService'
import type { SyncRecord } from '../src/shared/types/sync'
import type { Capture, Task } from '../src/shared/types/task'
import { HttpError, UnreachableError } from '../src/shared/utils/http'
import { MAX_PUSH_BYTES, MAX_RECORD_BYTES, RecordTooLargeError, recordBytes } from '../src/shared/utils/records'

vi.mock('../src/connectors/syncConnector', () => ({ pullRecords: vi.fn(), pushRecords: vi.fn() }))

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 't1',
  captureId: 'c1',
  title: 'Local title',
  createdAt: '2026-09-25T22:00:00.000Z',
  updatedAt: '2026-09-25T22:00:00.000Z',
  deletedAt: null,
  dueAt: null,
  reminderAt: null,
  pinned: false,
  completedAt: null,
  suggestionStatus: null,
  ...overrides,
})
const record = (value: Task): SyncRecord => ({ type: 'task', value })
const note = (id: string, characters: number): { type: 'capture'; value: Capture } => ({
  type: 'capture',
  value: {
    id,
    kind: 'text',
    text: 'a'.repeat(characters),
    timeZone: 'Europe/London',
    createdAt: '2026-09-25T22:00:00.000Z',
    updatedAt: '2026-09-25T22:00:00.000Z',
    deletedAt: null,
    ai: null,
  },
})

describe('local outbox', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    await clearLocalData()
  })

  it('saves a change and queues it in one step', async () => {
    await saveLocal([record(task())])
    expect((await loadData()).tasks).toHaveLength(1)
    expect((await readOutbox(10)).map((entry) => entry.key)).toEqual(['task:t1'])
  })

  it('keeps an entry that was edited again while its push was in flight', async () => {
    await saveLocal([record(task())])
    const inFlight = await readOutbox(10)
    await saveLocal([record(task({ title: 'Edited during push' }))])
    await acknowledgeOutbox(inFlight)
    const [remaining] = await readOutbox(10)
    expect(remaining.record.value).toMatchObject({ title: 'Edited during push' })
  })

  it('does not let a pull overwrite an unsent local edit', async () => {
    await saveLocal([record(task({ title: 'Unsent edit' }))])
    const applied = await applyRemote([record(task({ title: 'Server copy' })), record(task({ id: 't2' }))], 7)
    expect(applied.map((item) => item.value.id)).toEqual(['t2'])
    expect((await loadData()).tasks.find((item) => item.id === 't1')?.title).toBe('Unsent edit')
    expect(await readCursor()).toBe(7)
  })

  it('removes deleted records locally', async () => {
    await applyRemote([record(task())], 1)
    await applyRemote([record(task({ deletedAt: '2026-09-26T00:00:00.000Z' }))], 2)
    expect((await loadData()).tasks).toEqual([])
  })

  it('saves a very long note in full', async () => {
    await saveLocal([note('long', 1_000_000)])
    expect((await loadData()).captures[0].text).toHaveLength(1_000_000)
  })

  it('refuses a note too large for the server to store, and saves none of the batch', async () => {
    await expect(saveLocal([record(task()), note('huge', MAX_RECORD_BYTES)])).rejects.toBeInstanceOf(RecordTooLargeError)
    expect(await loadData()).toMatchObject({ captures: [], tasks: [] })
    expect(await readOutbox(10)).toEqual([])
  })
})

describe('sync', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    await clearLocalData()
  })

  it('pushes queued changes, then pulls every page', async () => {
    await saveLocal([record(task())])
    vi.mocked(pullRecords)
      .mockResolvedValueOnce({ records: [record(task({ id: 'remote-1' }))], cursor: 1, more: true })
      .mockResolvedValueOnce({ records: [record(task({ id: 'remote-2' }))], cursor: 2, more: false })

    const outcome = await requestSync()

    expect(pushRecords).toHaveBeenCalledWith([record(task())])
    expect(vi.mocked(pullRecords).mock.calls.map(([since]) => since)).toEqual([0, 1])
    expect(outcome).toMatchObject({ status: 'synced' })
    expect(await readOutbox(10)).toEqual([])
    expect((await loadData()).tasks.map((item) => item.id).sort()).toEqual(['remote-1', 'remote-2', 't1'])
  })

  it('sends many small changes in one push', async () => {
    await saveLocal(Array.from({ length: 30 }, (_, index) => record(task({ id: `t${index}` }))))
    vi.mocked(pullRecords).mockResolvedValue({ records: [], cursor: 0, more: false })
    await requestSync()
    expect(pushRecords).toHaveBeenCalledTimes(1)
    expect(vi.mocked(pushRecords).mock.calls[0][0]).toHaveLength(30)
  })

  it('splits large notes across pushes that each fit the server’s limit, and loses none', async () => {
    const notes = ['a', 'b', 'c'].map((id) => note(id, 1_000_000))
    await saveLocal(notes)
    vi.mocked(pullRecords).mockResolvedValue({ records: [], cursor: 0, more: false })

    expect(await requestSync()).toMatchObject({ status: 'synced' })

    const pushes = vi.mocked(pushRecords).mock.calls.map(([records]) => records)
    expect(pushes.map((records) => records.length)).toEqual([1, 1, 1]) // two 1 MB notes would pass the budget together
    for (const records of pushes) {
      expect(new TextEncoder().encode(JSON.stringify({ records })).byteLength).toBeLessThanOrEqual(MAX_PUSH_BYTES)
    }
    expect(pushes.flat().map((item) => item.value.id).sort()).toEqual(['a', 'b', 'c'])
    expect(await readOutbox(10)).toEqual([])
  })

  it('sends a note at the size limit on its own in one push the server accepts', async () => {
    const largest = note('largest', 1)
    largest.value.text = 'a'.repeat(MAX_RECORD_BYTES - recordBytes(largest) + 1)
    await saveLocal([largest, record(task())])
    vi.mocked(pullRecords).mockResolvedValue({ records: [], cursor: 0, more: false })
    await requestSync()
    const [first] = vi.mocked(pushRecords).mock.calls[0]
    expect(first).toHaveLength(1)
    expect(new TextEncoder().encode(JSON.stringify({ records: first })).byteLength).toBeLessThanOrEqual(MAX_PUSH_BYTES)
  })

  it('keeps local changes queued when offline or signed out', async () => {
    await saveLocal([record(task())])
    vi.mocked(pushRecords).mockRejectedValueOnce(new UnreachableError())
    expect(await requestSync()).toEqual({ status: 'offline' })
    vi.mocked(pushRecords).mockRejectedValueOnce(new HttpError(401, 'Sign in to continue.'))
    expect(await requestSync()).toEqual({ status: 'signed-out' })
    expect(await readOutbox(10)).toHaveLength(1)
  })

  it('runs one sync at a time and folds overlapping requests into one follow-up', async () => {
    let release: () => void = () => {}
    vi.mocked(pullRecords).mockImplementation(
      () => new Promise((resolve) => (release = () => resolve({ records: [], cursor: 0, more: false }))),
    )
    const first = requestSync()
    const second = requestSync()
    const third = requestSync()
    expect(second).toBe(third)
    await vi.waitFor(() => expect(pullRecords).toHaveBeenCalledTimes(1))
    release()
    await first
    await vi.waitFor(() => expect(pullRecords).toHaveBeenCalledTimes(2))
    release()
    await second
    expect(pullRecords).toHaveBeenCalledTimes(2)
  })
})

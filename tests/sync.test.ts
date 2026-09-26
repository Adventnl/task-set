import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pullRecords, pushRecords } from '../src/connectors/syncConnector'
import { acknowledgeOutbox, applyRemote, clearLocalData, loadData, readCursor, readOutbox, saveLocal } from '../src/services/localDataService'
import { requestSync } from '../src/services/syncService'
import type { SyncRecord } from '../src/shared/types/sync'
import type { Task } from '../src/shared/types/task'
import { HttpError, UnreachableError } from '../src/shared/utils/http'

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

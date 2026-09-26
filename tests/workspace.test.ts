import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearLocalData, loadData, readOutbox, saveLocal } from '../src/services/localDataService'
import { deleteCaptures, purgeExpiredTasks, setTaskCompleted, setTaskPinned } from '../src/services/workspaceService'
import type { SyncRecord } from '../src/shared/types/sync'
import type { Capture, Task } from '../src/shared/types/task'

const capture = (id: string): Capture => ({
  id,
  kind: 'text',
  text: `Message ${id}`,
  timeZone: 'UTC',
  createdAt: '2026-09-25T09:00:00.000Z',
  updatedAt: '2026-09-25T09:00:00.000Z',
  deletedAt: null,
  ai: 'ready',
})

const task = (id: string, captureId: string): Task => ({
  id,
  captureId,
  title: `Task ${id}`,
  createdAt: '2026-09-25T09:00:00.000Z',
  updatedAt: '2026-09-25T09:00:00.000Z',
  deletedAt: null,
  dueAt: null,
  reminderAt: null,
  pinned: false,
  completedAt: null,
  suggestionStatus: null,
})

describe('workspace operations', () => {
  const captures = [capture('a'), capture('b'), capture('c')]
  const tasks = [task('ta', 'a'), task('tb', 'b'), task('tc', 'c')]

  beforeEach(async () => {
    await clearLocalData()
    await saveLocal([
      ...captures.map((value): SyncRecord => ({ type: 'capture', value })),
      ...tasks.map((value): SyncRecord => ({ type: 'task', value })),
    ])
  })

  it('deletes several messages and only their tasks in one save, queued for sync', async () => {
    const records = await deleteCaptures([captures[0], captures[2]], tasks)
    expect(records.map((record) => `${record.type}:${record.value.id}`)).toEqual(['capture:a', 'capture:c', 'task:ta', 'task:tc'])
    expect(records.every((record) => record.value.deletedAt)).toBe(true)
    const left = await loadData()
    expect(left.captures.map(({ id }) => id)).toEqual(['b'])
    expect(left.tasks.map(({ id }) => id)).toEqual(['tb'])
    expect((await readOutbox(20)).filter((entry) => entry.record.value.deletedAt)).toHaveLength(4)
  })

  it('archives a task by completing it and restores it by reopening it', async () => {
    const [archived] = await setTaskCompleted(tasks[0], true)
    expect(archived.value).toMatchObject({ id: 'ta', deletedAt: null })
    expect((archived.value as Task).completedAt).toBeTruthy()
    const [restored] = await setTaskCompleted(archived.value as Task, false)
    expect(restored.value).toMatchObject({ id: 'ta', completedAt: null })
  })

  it('deletes archived tasks past their 60 days, queued for sync, and leaves the rest', async () => {
    const now = new Date('2026-12-01T00:00:00.000Z')
    const expired = { ...tasks[0], completedAt: '2026-09-25T00:00:00.000Z' }
    const recent = { ...tasks[1], completedAt: '2026-11-30T00:00:00.000Z' }
    await saveLocal([expired, recent].map((value): SyncRecord => ({ type: 'task', value })))

    const records = await purgeExpiredTasks([expired, recent, tasks[2]], now)
    expect(records.map((record) => `${record.type}:${record.value.id}:${record.value.deletedAt}`)).toEqual([`task:ta:${now.toISOString()}`])
    expect((await loadData()).tasks.map(({ id }) => id)).toEqual(['tb', 'tc'])
    expect((await readOutbox(20)).some((entry) => entry.key === 'task:ta' && entry.record.value.deletedAt)).toBe(true)
    expect(await purgeExpiredTasks([recent, tasks[2]], now)).toEqual([])
  })

  it('pins a task as a newer edit', async () => {
    const [record] = await setTaskPinned(tasks[1], true)
    expect(record.value).toMatchObject({ id: 'tb', pinned: true })
    expect(record.value.updatedAt > tasks[1].updatedAt).toBe(true)
  })
})

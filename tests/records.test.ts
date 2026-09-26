import { describe, expect, it } from 'vitest'
import type { Capture, Task } from '../src/shared/types/task'
import { mergeRecords, parseCapture, parseSyncRecord, parseTask } from '../src/shared/utils/records'
import { deletedTask, mergeCapture, mergeTask, suggestionTask } from '../worker/merge'

const capture: Capture = {
  id: 'c1',
  kind: 'voice',
  text: 'Change the Cloudflare email tomorrow morning',
  timeZone: 'Europe/London',
  createdAt: '2026-09-25T22:00:00.000Z',
  updatedAt: '2026-09-25T22:00:00.000Z',
  deletedAt: null,
  ai: null,
}

const task: Task = {
  id: 't1',
  captureId: 'c1',
  title: 'Change the Cloudflare email',
  createdAt: '2026-09-25T22:00:00.000Z',
  updatedAt: '2026-09-25T22:00:00.000Z',
  deletedAt: null,
  dueAt: null,
  reminderAt: '2026-09-26T08:00:00.000Z',
  pinned: false,
  completedAt: null,
  suggestionStatus: null,
}

describe('record validation', () => {
  it('accepts well-formed records and normalizes timestamps', () => {
    expect(parseCapture({ ...capture, createdAt: '2026-09-25T22:00:00Z' })?.createdAt).toBe('2026-09-25T22:00:00.000Z')
    expect(parseTask(task)).toEqual(task)
    expect(parseSyncRecord({ type: 'task', value: task })).toEqual({ type: 'task', value: task })
  })

  it('rejects malformed records at the boundary', () => {
    expect(parseCapture({ ...capture, text: '   ' })).toBeNull()
    expect(parseCapture({ ...capture, timeZone: 'Mars/Olympus' })).toBeNull()
    expect(parseCapture({ ...capture, id: 'has spaces' })).toBeNull()
    expect(parseCapture({ ...capture, ai: 'thinking' })).toBeNull()
    expect(parseTask({ ...task, dueAt: 'tomorrow' })).toBeNull()
    expect(parseTask({ ...task, pinned: 'yes' })).toBeNull()
    expect(parseSyncRecord({ type: 'note', value: task })).toBeNull()
  })

  it('merges changes into the on-screen snapshot and removes deletions', () => {
    const state = mergeRecords({ captures: [], tasks: [] }, [
      { type: 'capture', value: capture },
      { type: 'task', value: task },
    ])
    expect(state.tasks).toHaveLength(1)
    const next = mergeRecords(state, [{ type: 'task', value: { ...task, deletedAt: '2026-09-26T00:00:00.000Z' } }])
    expect(next.tasks).toHaveLength(0)
    expect(next.captures).toEqual([capture])
  })
})

describe('server merge rules', () => {
  it('queues a new capture for AI and never changes its text afterwards', () => {
    const stored = mergeCapture(null, capture)
    expect(stored?.ai).toBe('queued')
    expect(mergeCapture(stored, { ...capture, text: 'Rewritten' })).toBeNull()
  })

  it('accepts deletion of a capture once', () => {
    const stored = mergeCapture(null, capture)
    const deleted = mergeCapture(stored, { ...capture, deletedAt: '2026-09-26T00:00:00.000Z', updatedAt: '2026-09-26T00:00:00.000Z' })
    expect(deleted?.deletedAt).toBe('2026-09-26T00:00:00.000Z')
    expect(deleted?.ai).toBe('queued')
    expect(mergeCapture(deleted, { ...capture, deletedAt: '2026-09-27T00:00:00.000Z' })).toBeNull()
  })

  it('lets the most recent task edit win and keeps deletions final', () => {
    const newer = { ...task, title: 'Newer', updatedAt: '2026-09-26T10:00:00.000Z' }
    const older = { ...task, title: 'Older', updatedAt: '2026-09-26T09:00:00.000Z' }
    expect(mergeTask(newer, older)).toBeNull()
    expect(mergeTask(older, newer)?.title).toBe('Newer')
    expect(mergeTask(older, { ...newer, captureId: 'other' })?.captureId).toBe('c1')
    const gone = deletedTask(newer, '2026-09-26T11:00:00.000Z')
    expect(mergeTask(gone, { ...newer, updatedAt: '2026-09-27T00:00:00.000Z' })).toBeNull()
  })

  it('gives suggestions stable ids that any later edit overrides', () => {
    const draft = suggestionTask(capture, { title: 'Change the Cloudflare email', dueAt: null, reminderAt: null }, 0)
    expect(draft.id).toBe('c1:s0')
    expect(parseTask(draft)).toEqual(draft)
    const accepted = { ...draft, suggestionStatus: null, updatedAt: '2026-09-25T22:00:05.000Z' }
    expect(mergeTask(draft, accepted)?.suggestionStatus).toBeNull()
  })
})

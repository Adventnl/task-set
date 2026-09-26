import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Capture, Task } from '../src/shared/types/task'
import { openTaskCount, selectCaptureData, taskFromEditor, taskSections, whenLabel } from '../src/shared/utils/taskView'

const capture = (id: string, text: string, createdAt: string): Capture => ({
  id,
  kind: 'text',
  text,
  timeZone: 'UTC',
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
  ai: 'ready',
})

const base: Task = {
  id: 'task',
  captureId: 'a',
  title: 'Phone Sam',
  createdAt: '2026-09-25T00:00:00.000Z',
  updatedAt: '2026-09-25T00:00:00.000Z',
  deletedAt: null,
  dueAt: null,
  reminderAt: null,
  pinned: false,
  completedAt: null,
  suggestionStatus: null,
}

describe('feed data', () => {
  const captures = [capture('a', 'Call Sam', '2026-09-25T09:00:00'), capture('b', 'An unrelated note', '2026-09-26T09:00:00')]
  const tasks = [base, { ...base, id: 'hidden', captureId: 'b', title: 'Hidden suggestion', suggestionStatus: 'dismissed' as const }]

  it('searches visible linked tasks without surfacing dismissed suggestions', () => {
    expect(selectCaptureData(captures, tasks, 'phone').days.flatMap((day) => day.captures.map(({ id }) => id))).toEqual(['a'])
    expect(selectCaptureData(captures, tasks, 'hidden').matchCount).toBe(0)
    expect(selectCaptureData(captures, tasks, '').tasksByCapture.get('b')).toBeUndefined()
  })

  it('groups captures by local day in order', () => {
    expect(selectCaptureData(captures, tasks, '').days.map((day) => day.captures.length)).toEqual([1, 1])
  })
})

describe('task editor', () => {
  it('keeps a reminder without inventing a due date', () => {
    const reminderAt = '2026-09-26T09:00:00.000Z'
    const task = taskFromEditor({ captureId: 'a' }, { title: 'Call Sam', dueAt: null, reminderAt, pinned: false }, 'new-id', base.createdAt)
    expect(task).toMatchObject({ reminderAt, dueAt: null, deletedAt: null, suggestionStatus: null })
  })

  it('accepts a suggestion when it is saved from the editor', () => {
    const task = taskFromEditor({ captureId: 'a', task: { ...base, suggestionStatus: 'suggested' } }, { title: 'Edited', dueAt: null, reminderAt: null, pinned: false }, 'unused', '2026-09-26T00:00:00.000Z')
    expect(task).toMatchObject({ id: 'task', title: 'Edited', suggestionStatus: null })
  })
})

describe('task sections', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-26T12:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  const rows: Task[] = [
    { ...base, id: 'overdue', dueAt: '2026-09-25T09:00:00' },
    { ...base, id: 'pinned-dated', pinned: true, dueAt: '2026-09-30T09:00:00' },
    { ...base, id: 'pinned', pinned: true },
    { ...base, id: 'undated-old', createdAt: '2026-09-20T00:00:00.000Z' },
    { ...base, id: 'undated-new', createdAt: '2026-09-26T00:00:00.000Z' },
    { ...base, id: 'future', dueAt: '2026-09-28T09:00:00' },
    { ...base, id: 'remind-tomorrow', reminderAt: '2026-09-27T09:00:00' },
    { ...base, id: 'draft', suggestionStatus: 'suggested' },
    { ...base, id: 'done', completedAt: '2026-09-26T08:00:00' },
    { ...base, id: 'done-yesterday', completedAt: '2026-09-25T08:00:00' },
  ]

  it('puts pinned work first, then undated work newest first, then dated work soonest first', () => {
    expect(taskSections(rows).map((section) => [section.label, section.tasks.map(({ id }) => id)])).toEqual([
      ['Pinned', ['pinned', 'pinned-dated']],
      ['No date', ['undated-new', 'undated-old']],
      ['Scheduled', ['overdue', 'remind-tomorrow', 'future']],
      ['Done today', ['done']],
    ])
  })

  it('omits empty sections and counts only open tasks', () => {
    expect(taskSections([{ ...base, id: 'only' }]).map((section) => section.id)).toEqual(['undated'])
    expect(taskSections([])).toEqual([])
    expect(openTaskCount(rows)).toBe(7)
  })

  it('labels dates relative to today', () => {
    expect(whenLabel('2026-09-27T09:00:00')).toMatch(/^Tomorrow /)
  })
})

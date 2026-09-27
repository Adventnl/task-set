import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Capture, Task } from '../src/shared/types/task'
import { archivedTasks, expiredTasks, openTaskCount, selectCaptureData, taskFromEditor, taskSections, viewDetail, whenLabel } from '../src/shared/utils/taskView'

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

  it('leaves completed tasks off their note, since they are in the Archive', () => {
    const done = { ...base, id: 'done', title: 'Archived call', completedAt: '2026-09-26T08:00:00.000Z' }
    const data = selectCaptureData(captures, [...tasks, done], '')
    expect(data.tasksByCapture.get('a')?.map(({ id }) => id)).toEqual(['task'])
    expect(selectCaptureData(captures, [done], 'archived').matchCount).toBe(0)
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

  it('puts pinned work first, then undated work newest first, then dated work soonest first, leaving out completed work', () => {
    expect(taskSections(rows).map((section) => [section.label, section.tasks.map(({ id }) => id)])).toEqual([
      ['Pinned', ['pinned', 'pinned-dated']],
      ['No date', ['undated-new', 'undated-old']],
      ['Scheduled', ['overdue', 'remind-tomorrow', 'future']],
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

  it('describes each view under its title', () => {
    const counts = { notes: 1, openTasks: 3, matches: null, upcoming: 2, meetings: 1 }
    expect(viewDetail('feed', counts)).toBe('1 note')
    expect(viewDetail('feed', { ...counts, notes: 0 })).toBe('No notes yet')
    expect(viewDetail('feed', { ...counts, matches: 2 })).toBe('2 matching notes')
    expect(viewDetail('tasks', counts)).toBe('3 open')
    expect(viewDetail('tasks', { ...counts, openTasks: 0 })).toBe('Nothing open')
    expect(viewDetail('archive', counts)).toBe('Completed tasks stay here for 60 days')
    expect(viewDetail('calendar', counts)).toBe('2 coming up')
    expect(viewDetail('calendar', { ...counts, upcoming: 0 })).toBe('Nothing coming up')
    expect(viewDetail('meetings', counts)).toBe('1 meeting')
    expect(viewDetail('meetings', { ...counts, meetings: 0 })).toBe('No meetings yet')
  })
})

describe('archive', () => {
  const now = new Date('2026-09-26T12:00:00.000Z')
  const completed = (id: string, completedAt: string, overrides: Partial<Task> = {}): Task => ({ ...base, id, completedAt, ...overrides })
  const rows: Task[] = [
    completed('older', '2026-09-01T12:00:00.000Z'),
    completed('newest', '2026-09-26T11:00:00.000Z'),
    completed('last-day', '2026-07-28T13:00:00.000Z'),
    completed('expired', '2026-07-28T12:00:00.000Z'),
    completed('long-gone', '2026-01-01T00:00:00.000Z'),
    { ...base, id: 'open' },
    completed('suggestion', '2026-09-26T00:00:00.000Z', { suggestionStatus: 'suggested' }),
  ]

  it('lists completed tasks newest first with the days left before deletion', () => {
    expect(archivedTasks(rows, now).map(({ task, daysLeft }) => [task.id, daysLeft])).toEqual([
      ['newest', 60],
      ['older', 35],
      ['last-day', 1],
    ])
  })

  it('finds tasks completed 60 or more days ago, and nothing else', () => {
    expect(expiredTasks(rows, now).map(({ id }) => id)).toEqual(['expired', 'long-gone'])
    expect(expiredTasks([{ ...base, id: 'open' }], now)).toEqual([])
  })
})

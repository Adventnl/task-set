import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Capture, Task } from '../src/shared/types/task'
import { sectionsForView, selectCaptureData, taskFromEditor, tasksForView, whenLabel } from '../src/shared/utils/taskView'

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

describe('task views', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-26T12:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  const rows: Task[] = [
    { ...base, id: 'overdue', dueAt: '2026-09-25T09:00:00' },
    { ...base, id: 'pinned', pinned: true },
    { ...base, id: 'remind-today', reminderAt: '2026-09-26T18:00:00' },
    { ...base, id: 'inbox' },
    { ...base, id: 'future', dueAt: '2026-09-28T09:00:00' },
    { ...base, id: 'remind-tomorrow', reminderAt: '2026-09-27T09:00:00' },
    { ...base, id: 'draft', suggestionStatus: 'suggested' },
    { ...base, id: 'done', completedAt: '2026-09-26T08:00:00' },
  ]

  it('schedules by due date or, failing that, reminder', () => {
    expect(tasksForView(rows, 'today').map(({ id }) => id)).toEqual(['overdue', 'remind-today', 'pinned'])
    expect(tasksForView(rows, 'inbox').map(({ id }) => id)).toEqual(['inbox'])
    expect(tasksForView(rows, 'upcoming').map(({ id }) => id)).toEqual(['remind-tomorrow', 'future'])
  })

  it('splits Today into overdue, today, and done', () => {
    expect(sectionsForView(rows, 'today').map((section) => [section.label, section.tasks.map(({ id }) => id)])).toEqual([
      ['Overdue', ['overdue']],
      ['Today', ['remind-today', 'pinned']],
      ['Done today', ['done']],
    ])
  })

  it('groups Upcoming by day with relative labels', () => {
    expect(sectionsForView(rows, 'upcoming').map((section) => section.label)).toEqual(['Tomorrow', expect.stringMatching(/Monday/)])
    expect(whenLabel('2026-09-27T09:00:00')).toMatch(/^Tomorrow /)
  })
})

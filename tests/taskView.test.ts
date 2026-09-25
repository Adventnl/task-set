import { describe, expect, it, vi } from 'vitest'
import { selectCaptureData, taskFromEditor, tasksForView } from '../src/shared/utils/taskView'
import type { Capture, Task } from '../src/shared/types/task'

const captures: Capture[] = [
  {
    id: 'a',
    kind: 'text',
    text: 'Call Sam',
    createdAt: '2026-09-25T00:00:00.000Z',
  },
  {
    id: 'b',
    kind: 'text',
    text: 'An unrelated note',
    createdAt: '2026-09-25T01:00:00.000Z',
  },
]

const tasks: Task[] = [
  {
    id: 'task-a',
    captureId: 'a',
    title: 'Phone Sam',
    createdAt: captures[0].createdAt,
    updatedAt: captures[0].createdAt,
    dueAt: null,
    reminderAt: null,
    pinned: false,
    completedAt: null,
  },
  {
    id: 'task-b',
    captureId: 'b',
    title: 'Hidden suggestion',
    createdAt: captures[1].createdAt,
    updatedAt: captures[1].createdAt,
    dueAt: null,
    reminderAt: null,
    pinned: false,
    completedAt: null,
    suggestionStatus: 'dismissed',
  },
]

describe('task view data', () => {
  it('searches visible linked tasks without surfacing dismissed suggestions', () => {
    expect(
      selectCaptureData(captures, tasks, 'phone').visibleCaptures.map(
        ({ id }) => id,
      ),
    ).toEqual(['a'])
    expect(
      selectCaptureData(captures, tasks, 'hidden').visibleCaptures,
    ).toEqual([])
    expect(
      selectCaptureData(captures, tasks, '').tasksByCapture.get('b'),
    ).toBeUndefined()
  })

  it('preserves a reminder when creating a manual task', () => {
    const reminderAt = '2026-09-26T09:00:00.000Z'
    const task = taskFromEditor(
      { captureId: 'a' },
      { title: 'Call Sam', dueAt: null, reminderAt, pinned: false },
      'new-id',
      captures[0].createdAt,
    )
    expect(task.reminderAt).toBe(reminderAt)
    expect(task.dueAt).toBeNull()
  })

  it('places overdue, pinned, undated, and future work in the intended views', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-26T12:00:00'))
    try {
      const rows: Task[] = [
        { ...tasks[0], id: 'overdue', dueAt: '2026-09-25T09:00:00' },
        { ...tasks[0], id: 'pinned', pinned: true },
        { ...tasks[0], id: 'inbox' },
        { ...tasks[0], id: 'future', dueAt: '2026-09-28T09:00:00' },
      ]
      expect(tasksForView(rows, 'today').map(({ id }) => id)).toEqual(['overdue', 'pinned'])
      expect(tasksForView(rows, 'inbox').map(({ id }) => id)).toEqual(['inbox'])
      expect(tasksForView(rows, 'upcoming').map(({ id }) => id)).toEqual(['future'])
    } finally {
      vi.useRealTimers()
    }
  })
})

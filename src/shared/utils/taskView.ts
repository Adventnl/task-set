import type { Capture, Editor, Task, TaskInput, View } from '../types/task'

export function dayKey(value: string): string {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export function dayLabel(value: string): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (dayKey(value) === dayKey(today.toISOString())) return 'Today'
  if (dayKey(value) === dayKey(yesterday.toISOString())) return 'Yesterday'
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export function timeLabel(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function dateTimeLabel(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function toLocalInput(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  const pad = (number: number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

export function tasksForView(tasks: Task[], view: View): Task[] {
  const active = tasks.filter(
    (task) => !task.completedAt && !task.suggestionStatus,
  )
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)
  const filtered = active.filter((task) => {
    if (view === 'today')
      return task.pinned || (!!task.dueAt && new Date(task.dueAt) <= endOfToday)
    if (view === 'inbox') return !task.pinned && !task.dueAt
    return !task.pinned && !!task.dueAt && new Date(task.dueAt) > endOfToday
  })
  return filtered.sort((a, b) => {
    if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt)
    if (a.dueAt) return -1
    if (b.dueAt) return 1
    return b.createdAt.localeCompare(a.createdAt)
  })
}

export function selectCaptureData(
  captures: Capture[],
  tasks: Task[],
  search: string,
) {
  const tasksByCapture = new Map<string, Task[]>()
  for (const task of tasks) {
    if (task.suggestionStatus === 'dismissed') continue
    const linked = tasksByCapture.get(task.captureId) ?? []
    linked.push(task)
    tasksByCapture.set(task.captureId, linked)
  }

  const term = search.trim().toLocaleLowerCase()
  const visibleCaptures = term
    ? captures.filter(
        (capture) =>
          capture.text.toLocaleLowerCase().includes(term) ||
          tasksByCapture
            .get(capture.id)
            ?.some((task) => task.title.toLocaleLowerCase().includes(term)),
      )
    : captures

  return { visibleCaptures, tasksByCapture }
}

export function taskFromEditor(
  editor: Editor,
  input: TaskInput,
  id: string,
  now: string,
): Task {
  return editor.task
    ? { ...editor.task, ...input, updatedAt: now }
    : {
        id,
        captureId: editor.captureId,
        ...input,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      }
}

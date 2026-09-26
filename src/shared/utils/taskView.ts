import { ARCHIVE_DAYS } from '../config/archive'
import type { Capture, Editor, Task, TaskInput, View } from '../types/task'

export interface TaskSection {
  id: 'pinned' | 'undated' | 'scheduled'
  label: string
  tasks: Task[]
}

export interface ArchivedTask {
  task: Task & { completedAt: string }
  /** Whole days until it is deleted for good; at least 1. */
  daysLeft: number
}

export interface CaptureDay {
  key: string
  label: string
  captures: Capture[]
}

const DAY_MS = 86_400_000

function startOfDay(date: Date): Date {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  return start
}

/** Whole local days from today: 0 today, 1 tomorrow, -1 yesterday. */
function dayOffset(value: string, now: Date): number {
  return Math.round((startOfDay(new Date(value)).getTime() - startOfDay(now).getTime()) / DAY_MS)
}

export function dayKey(value: string): string {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

export function dayLabel(value: string, now = new Date()): string {
  const offset = dayOffset(value, now)
  if (offset === 0) return 'Today'
  if (offset === -1) return 'Yesterday'
  if (offset === 1) return 'Tomorrow'
  const sameYear = new Date(value).getFullYear() === now.getFullYear()
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(new Date(value))
}

export function timeLabel(value: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

/** A short relative date and time, such as "Tomorrow 9:00 AM" or "Fri 9:00 AM". */
export function whenLabel(value: string, now = new Date()): string {
  const offset = dayOffset(value, now)
  const time = timeLabel(value)
  if (offset === 0) return `Today ${time}`
  if (offset === 1) return `Tomorrow ${time}`
  if (offset === -1) return `Yesterday ${time}`
  const day = new Intl.DateTimeFormat(undefined, offset > 1 && offset < 7 ? { weekday: 'short' } : { month: 'short', day: 'numeric' })
  return `${day.format(new Date(value))} ${time}`
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

/** When a task is scheduled: its deadline, otherwise its reminder. */
export function taskWhen(task: Task): string | null {
  return task.dueAt ?? task.reminderAt
}

export function isOverdue(task: Task, now = new Date()): boolean {
  return !task.completedAt && !!task.dueAt && new Date(task.dueAt) < now
}

function isOpen(task: Task): boolean {
  return !task.completedAt && !task.suggestionStatus
}

/** Completing a task archives it. */
function isArchived(task: Task): task is Task & { completedAt: string } {
  return !!task.completedAt && !task.suggestionStatus
}

function archiveExpiry(task: Task & { completedAt: string }): number {
  return Date.parse(task.completedAt) + ARCHIVE_DAYS * DAY_MS
}

/** Undated tasks first, newest first; then dated tasks, soonest first. */
function byTaskOrder(a: Task, b: Task): number {
  const aWhen = taskWhen(a)
  const bWhen = taskWhen(b)
  if (aWhen && bWhen) return aWhen.localeCompare(bWhen)
  if (aWhen) return 1
  if (bWhen) return -1
  return b.createdAt.localeCompare(a.createdAt)
}

/** Open tasks: pinned work, then work with no date, then scheduled work. Completed tasks are in the Archive. */
export function taskSections(tasks: Task[]): TaskSection[] {
  const open = tasks.filter(isOpen).sort(byTaskOrder)
  const sections: TaskSection[] = [
    { id: 'pinned', label: 'Pinned', tasks: open.filter((task) => task.pinned) },
    { id: 'undated', label: 'No date', tasks: open.filter((task) => !task.pinned && !taskWhen(task)) },
    { id: 'scheduled', label: 'Scheduled', tasks: open.filter((task) => !task.pinned && taskWhen(task)) },
  ]
  return sections.filter((section) => section.tasks.length)
}

export function openTaskCount(tasks: Task[]): number {
  return tasks.filter(isOpen).length
}

/** The Archive, most recently completed first. Tasks past their retention are left out. */
export function archivedTasks(tasks: Task[], now = new Date()): ArchivedTask[] {
  return tasks
    .filter(isArchived)
    .map((task) => ({ task, daysLeft: Math.ceil((archiveExpiry(task) - now.getTime()) / DAY_MS) }))
    .filter((item) => item.daysLeft > 0)
    .sort((a, b) => b.task.completedAt.localeCompare(a.task.completedAt))
}

/** Archived tasks whose retention has ended and that should be deleted for good. */
export function expiredTasks(tasks: Task[], now = new Date()): Task[] {
  return tasks.filter((task) => isArchived(task) && archiveExpiry(task) <= now.getTime())
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/** The line under a view's title. `matches` is set while searching Notes. */
export function viewDetail(view: View, counts: { notes: number; openTasks: number; matches: number | null }): string {
  if (view === 'archive') return `Completed tasks stay here for ${ARCHIVE_DAYS} days`
  if (view === 'tasks') return counts.openTasks ? `${counts.openTasks} open` : 'Nothing open'
  if (counts.matches !== null) return plural(counts.matches, 'matching note')
  return counts.notes ? plural(counts.notes, 'note') : 'No notes yet'
}

/** Links open tasks and suggestions to captures, filters by search, and groups captures by day. */
export function selectCaptureData(captures: Capture[], tasks: Task[], search: string) {
  const tasksByCapture = new Map<string, Task[]>()
  for (const task of tasks) {
    if (task.suggestionStatus === 'dismissed' || task.completedAt) continue
    const linked = tasksByCapture.get(task.captureId) ?? []
    linked.push(task)
    tasksByCapture.set(task.captureId, linked)
  }
  const term = search.trim().toLocaleLowerCase()
  const visibleCaptures = term
    ? captures.filter(
        (capture) =>
          capture.text.toLocaleLowerCase().includes(term) ||
          tasksByCapture.get(capture.id)?.some((task) => task.title.toLocaleLowerCase().includes(term)),
      )
    : captures
  const days: CaptureDay[] = []
  for (const capture of visibleCaptures) {
    const key = dayKey(capture.createdAt)
    if (days.at(-1)?.key !== key) days.push({ key, label: dayLabel(capture.createdAt), captures: [] })
    days[days.length - 1].captures.push(capture)
  }
  return { days, captures: visibleCaptures, tasksByCapture, matchCount: visibleCaptures.length }
}

/** Saving from the editor also accepts a suggestion, since the user has reviewed it. */
export function taskFromEditor(editor: Editor, input: TaskInput, id: string, now: string): Task {
  return editor.task
    ? { ...editor.task, ...input, suggestionStatus: null, updatedAt: now }
    : {
        id,
        captureId: editor.captureId,
        ...input,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        completedAt: null,
        suggestionStatus: null,
      }
}

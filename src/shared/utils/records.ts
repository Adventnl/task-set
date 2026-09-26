import type { SyncRecord } from '../types/sync'
import type { Capture, Task } from '../types/task'

export const MAX_CAPTURE_LENGTH = 4000
export const MAX_TITLE_LENGTH = 200
const ID_PATTERN = /^[A-Za-z0-9:_-]{1,120}$/

type Fields = Record<string, unknown>

function isObject(value: unknown): value is Fields {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isoOrNull(value: unknown): string | null | undefined {
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined
}

function iso(value: unknown): string | undefined {
  return isoOrNull(value) ?? undefined
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 64) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return true
  } catch {
    return false
  }
}

export function parseCapture(value: unknown): Capture | null {
  if (!isObject(value)) return null
  const { id, kind, text, timeZone, ai } = value
  const createdAt = iso(value.createdAt)
  const updatedAt = iso(value.updatedAt)
  const deletedAt = isoOrNull(value.deletedAt ?? null)
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return null
  if (kind !== 'text' && kind !== 'voice') return null
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_CAPTURE_LENGTH) return null
  if (!isValidTimeZone(timeZone) || !createdAt || !updatedAt || deletedAt === undefined) return null
  if (ai !== null && ai !== undefined && ai !== 'queued' && ai !== 'ready' && ai !== 'failed') return null
  return { id, kind, text, timeZone, createdAt, updatedAt, deletedAt, ai: ai ?? null }
}

export function parseTask(value: unknown): Task | null {
  if (!isObject(value)) return null
  const { id, captureId, title, pinned } = value
  const suggestionStatus = value.suggestionStatus ?? null
  const createdAt = iso(value.createdAt)
  const updatedAt = iso(value.updatedAt)
  const deletedAt = isoOrNull(value.deletedAt ?? null)
  const dueAt = isoOrNull(value.dueAt ?? null)
  const reminderAt = isoOrNull(value.reminderAt ?? null)
  const completedAt = isoOrNull(value.completedAt ?? null)
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return null
  if (typeof captureId !== 'string' || !ID_PATTERN.test(captureId)) return null
  if (typeof title !== 'string' || !title.trim() || title.length > MAX_TITLE_LENGTH) return null
  if (typeof pinned !== 'boolean' || !createdAt || !updatedAt) return null
  if ([deletedAt, dueAt, reminderAt, completedAt].includes(undefined)) return null
  if (suggestionStatus !== null && suggestionStatus !== 'suggested' && suggestionStatus !== 'dismissed') return null
  return {
    id,
    captureId,
    title: title.trim(),
    createdAt,
    updatedAt,
    deletedAt: deletedAt ?? null,
    dueAt: dueAt ?? null,
    reminderAt: reminderAt ?? null,
    pinned,
    completedAt: completedAt ?? null,
    suggestionStatus,
  }
}

export function parseSyncRecord(value: unknown): SyncRecord | null {
  if (!isObject(value)) return null
  if (value.type === 'capture') {
    const capture = parseCapture(value.value)
    return capture && { type: 'capture', value: capture }
  }
  if (value.type === 'task') {
    const task = parseTask(value.value)
    return task && { type: 'task', value: task }
  }
  return null
}

export function recordKey(record: SyncRecord): string {
  return `${record.type}:${record.value.id}`
}

function byCreatedAt<T extends { id: string; createdAt: string }>(a: T, b: T): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
}

/** Applies records to an in-memory snapshot; deleted records are removed. */
export function mergeRecords(
  state: { captures: Capture[]; tasks: Task[] },
  records: SyncRecord[],
): { captures: Capture[]; tasks: Task[] } {
  if (!records.length) return state
  const captures = new Map(state.captures.map((item) => [item.id, item]))
  const tasks = new Map(state.tasks.map((item) => [item.id, item]))
  const apply = <T extends Capture | Task>(target: Map<string, T>, value: T) => {
    if (value.deletedAt) target.delete(value.id)
    else target.set(value.id, value)
  }
  for (const record of records) {
    if (record.type === 'capture') apply(captures, record.value)
    else apply(tasks, record.value)
  }
  return {
    captures: [...captures.values()].sort(byCreatedAt),
    tasks: [...tasks.values()].sort(byCreatedAt),
  }
}

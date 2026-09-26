import type { CalendarEvent } from '../types/calendar'
import type { Meeting, MeetingNote } from '../types/meeting'
import type { SyncRecord, WorkspaceData } from '../types/sync'
import type { Capture, Task } from '../types/task'
import { isDateKey, isTimeKey } from './dates'

export const MAX_CAPTURE_LENGTH = 4000
export const MAX_TITLE_LENGTH = 200
const ID_PATTERN = /^[A-Za-z0-9:_-]{1,120}$/

type Fields = Record<string, unknown>
/** The fields every synced record carries. */
type Base = { id: string; createdAt: string; updatedAt: string; deletedAt: string | null }

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

function isId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value)
}

function isText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && !!value.trim() && value.length <= maxLength
}

function parseBase(value: Fields): Base | null {
  const createdAt = iso(value.createdAt)
  const updatedAt = iso(value.updatedAt)
  const deletedAt = isoOrNull(value.deletedAt ?? null)
  if (!isId(value.id) || !createdAt || !updatedAt || deletedAt === undefined) return null
  return { id: value.id, createdAt, updatedAt, deletedAt }
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
  const base = parseBase(value)
  const { kind, text, timeZone, ai } = value
  if (!base || (kind !== 'text' && kind !== 'voice')) return null
  if (!isText(text, MAX_CAPTURE_LENGTH) || !isValidTimeZone(timeZone)) return null
  if (ai !== null && ai !== undefined && ai !== 'queued' && ai !== 'ready' && ai !== 'failed') return null
  return { ...base, kind, text, timeZone, ai: ai ?? null }
}

export function parseTask(value: unknown): Task | null {
  if (!isObject(value)) return null
  const base = parseBase(value)
  const { captureId, title, pinned } = value
  const suggestionStatus = value.suggestionStatus ?? null
  const dueAt = isoOrNull(value.dueAt ?? null)
  const reminderAt = isoOrNull(value.reminderAt ?? null)
  const completedAt = isoOrNull(value.completedAt ?? null)
  if (!base || !isId(captureId) || !isText(title, MAX_TITLE_LENGTH) || typeof pinned !== 'boolean') return null
  if (dueAt === undefined || reminderAt === undefined || completedAt === undefined) return null
  if (suggestionStatus !== null && suggestionStatus !== 'suggested' && suggestionStatus !== 'dismissed') return null
  return { ...base, captureId, title: title.trim(), dueAt, reminderAt, pinned, completedAt, suggestionStatus }
}

export function parseEvent(value: unknown): CalendarEvent | null {
  if (!isObject(value)) return null
  const base = parseBase(value)
  const { date, text } = value
  if (!base || !isDateKey(date) || !isText(text, MAX_CAPTURE_LENGTH)) return null
  return { ...base, date, text }
}

export function parseMeeting(value: unknown): Meeting | null {
  if (!isObject(value)) return null
  const base = parseBase(value)
  const { title, date } = value
  const time = value.time ?? null
  const repeat = value.repeat ?? null
  if (!base || !isText(title, MAX_TITLE_LENGTH) || !isDateKey(date)) return null
  if ((time !== null && !isTimeKey(time)) || (repeat !== null && repeat !== 'weekly')) return null
  return { ...base, title: title.trim(), date, time, repeat }
}

export function parseMeetingNote(value: unknown): MeetingNote | null {
  if (!isObject(value)) return null
  const base = parseBase(value)
  const { meetingId, date, text } = value
  if (!base || !isId(meetingId) || !isDateKey(date) || !isText(text, MAX_CAPTURE_LENGTH)) return null
  return { ...base, meetingId, date, text }
}

export function parseSyncRecord(value: unknown): SyncRecord | null {
  if (!isObject(value)) return null
  switch (value.type) {
    case 'capture': {
      const capture = parseCapture(value.value)
      return capture && { type: 'capture', value: capture }
    }
    case 'task': {
      const task = parseTask(value.value)
      return task && { type: 'task', value: task }
    }
    case 'event': {
      const event = parseEvent(value.value)
      return event && { type: 'event', value: event }
    }
    case 'meeting': {
      const meeting = parseMeeting(value.value)
      return meeting && { type: 'meeting', value: meeting }
    }
    case 'meetingNote': {
      const note = parseMeetingNote(value.value)
      return note && { type: 'meetingNote', value: note }
    }
  }
  return null
}

export function recordKey(record: SyncRecord): string {
  return `${record.type}:${record.value.id}`
}

/** The same record, deleted at `at`. Deletions sync like any other edit. */
export function markDeleted<T extends Base>(value: T, at: string): T {
  return { ...value, deletedAt: at, updatedAt: at }
}

export const EMPTY_WORKSPACE: WorkspaceData = { captures: [], tasks: [], events: [], meetings: [], meetingNotes: [] }

export function byCreatedAt<T extends Base>(a: T, b: T): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
}

/** Applies changed values to one list; deleted values are removed. Returns the same list when nothing changed. */
function applyValues<T extends Base>(list: T[], values: T[]): T[] {
  if (!values.length) return list
  const byId = new Map(list.map((item) => [item.id, item]))
  for (const value of values) {
    if (value.deletedAt) byId.delete(value.id)
    else byId.set(value.id, value)
  }
  return [...byId.values()].sort(byCreatedAt)
}

/** Applies records to an in-memory snapshot; deleted records are removed. */
export function mergeRecords(state: WorkspaceData, records: SyncRecord[]): WorkspaceData {
  if (!records.length) return state
  return {
    captures: applyValues(state.captures, records.flatMap((record) => (record.type === 'capture' ? [record.value] : []))),
    tasks: applyValues(state.tasks, records.flatMap((record) => (record.type === 'task' ? [record.value] : []))),
    events: applyValues(state.events, records.flatMap((record) => (record.type === 'event' ? [record.value] : []))),
    meetings: applyValues(state.meetings, records.flatMap((record) => (record.type === 'meeting' ? [record.value] : []))),
    meetingNotes: applyValues(state.meetingNotes, records.flatMap((record) => (record.type === 'meetingNote' ? [record.value] : []))),
  }
}

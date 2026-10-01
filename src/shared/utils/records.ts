import type { CalendarEvent } from '../types/calendar'
import type { Meeting, MeetingNote } from '../types/meeting'
import type { SyncRecord, WorkspaceData } from '../types/sync'
import type { Capture, Task } from '../types/task'
import { isDateKey, isTimeKey } from './dates'

/** Task and meeting titles are one-line names. Notes, calendar entries, and meeting notes have no length limit of their own. */
export const MAX_TITLE_LENGTH = 200
/**
 * The one ceiling on a record is storage: it is kept as a single JSON row, and Cloudflare limits a
 * Durable Object's SQLite row to 2 MB. This leaves room for the row's other columns and for a
 * deletion, which rewrites the same record.
 */
export const MAX_RECORD_BYTES = 1_900_000
/** A sync request carries at most one largest record, plus the JSON around it. */
export const MAX_PUSH_BYTES = MAX_RECORD_BYTES + 64 * 1024
const ID_PATTERN = /^[A-Za-z0-9:_-]{1,120}$/
const encoder = new TextEncoder()

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

function isText(value: unknown, maxLength = Infinity): value is string {
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
  const archivedAt = isoOrNull(value.archivedAt ?? null)
  if (!base || (kind !== 'text' && kind !== 'voice')) return null
  if (archivedAt === undefined) return null
  if (!isText(text) || !isValidTimeZone(timeZone)) return null
  if (ai !== null && ai !== undefined && ai !== 'queued' && ai !== 'ready' && ai !== 'failed') return null
  return { ...base, kind, text, timeZone, archivedAt, ai: ai ?? null }
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
  if (!base || !isDateKey(date) || !isText(text)) return null
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
  if (!base || !isId(meetingId) || !isDateKey(date) || !isText(text)) return null
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

/** A record's size as stored: its JSON, in UTF-8 bytes. */
export function recordBytes(record: SyncRecord): number {
  return encoder.encode(JSON.stringify(record.value)).byteLength
}

export function fitsInStorage(record: SyncRecord): boolean {
  return recordBytes(record) <= MAX_RECORD_BYTES
}

/** A record is too large to store. The message tells the writer what to do, so a screen can show it as is. */
export class RecordTooLargeError extends Error {
  constructor() {
    super(`That is too large to save. One note holds up to about ${(MAX_RECORD_BYTES / 1_000_000).toFixed(1)} MB of text; split it into two.`)
    this.name = 'RecordTooLargeError'
  }
}

/**
 * The longest run of `items`, from the start, within `maxBytes` and `maxCount`. It always takes the
 * first item, so one large record still goes through alone. `more` says whether anything was left.
 */
export function takeWithinBytes<T>(
  items: Iterable<T>,
  sizeOf: (item: T) => number,
  maxBytes: number,
  maxCount = Infinity,
): { taken: T[]; more: boolean } {
  const taken: T[] = []
  let bytes = 0
  for (const item of items) {
    const size = sizeOf(item)
    if (taken.length && (taken.length >= maxCount || bytes + size > maxBytes)) return { taken, more: true }
    taken.push(item)
    bytes += size
  }
  return { taken, more: false }
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

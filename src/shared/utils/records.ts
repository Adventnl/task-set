import type { CalendarEvent } from '../types/calendar'
import type { Meeting, MeetingNote } from '../types/meeting'
import type { SyncRecord, WorkspaceData } from '../types/sync'
import type { Capture, Task } from '../types/task'
import { isDateKey, isTimeKey } from './dates'
import type { MapCategory, MapPin } from '../types/map'

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
  if (!base || (captureId !== null && !isId(captureId)) || !isText(title, MAX_TITLE_LENGTH) || typeof pinned !== 'boolean') return null
  if (dueAt === undefined || reminderAt === undefined || completedAt === undefined) return null
  if (suggestionStatus !== null && suggestionStatus !== 'suggested' && suggestionStatus !== 'dismissed') return null
  const tags = value.tags
  if (tags !== undefined && (!Array.isArray(tags) || tags.length > 5 || !tags.every((tag) => isText(tag, 30)))) return null
  return { ...base, captureId, title: title.trim(), dueAt, reminderAt, pinned, completedAt, suggestionStatus, ...(tags ? { tags: tags as string[] } : {}) }
}

export function parseEvent(value: unknown): CalendarEvent | null {
  if (!isObject(value)) return null
  const base = parseBase(value)
  const { date, text } = value
  if (!base || !isDateKey(date) || !isText(text, MAX_CAPTURE_LENGTH)) return null
  if (value.repeat != null && value.repeat !== 'yearly') return null
  if (value.category != null && value.category !== 'birthday') return null
  return { ...base, date, text, ...(value.repeat !== undefined ? { repeat: value.repeat as 'yearly' | null } : {}), ...(value.category !== undefined ? { category: value.category as 'birthday' | null } : {}) }
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
    case 'mapCategory': { const category = parseMapCategory(value.value); return category && { type: 'mapCategory', value: category } }
    case 'mapPin': { const pin = parseMapPin(value.value); return pin && { type: 'mapPin', value: pin } }
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

export const EMPTY_WORKSPACE: WorkspaceData = { captures: [], tasks: [], events: [], meetings: [], meetingNotes: [], mapCategories: [], mapPins: [] }

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
    mapCategories: applyValues(state.mapCategories, records.flatMap((record) => record.type === 'mapCategory' ? [record.value] : [])),
    mapPins: applyValues(state.mapPins, records.flatMap((record) => record.type === 'mapPin' ? [record.value] : [])),
    captures: applyValues(state.captures, records.flatMap((record) => (record.type === 'capture' ? [record.value] : []))),
    tasks: applyValues(state.tasks, records.flatMap((record) => (record.type === 'task' ? [record.value] : []))),
    events: applyValues(state.events, records.flatMap((record) => (record.type === 'event' ? [record.value] : []))),
    meetings: applyValues(state.meetings, records.flatMap((record) => (record.type === 'meeting' ? [record.value] : []))),
    meetingNotes: applyValues(state.meetingNotes, records.flatMap((record) => (record.type === 'meetingNote' ? [record.value] : []))),
  }
}

export function parseMapCategory(value: unknown): MapCategory | null {
  if (!isObject(value)) return null
  const base = parseBase(value)
  if (!base || !isText(value.name, 60) || typeof value.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(value.color)) return null
  return { ...base, name: value.name.trim(), color: value.color }
}
export function parseMapPin(value: unknown): MapPin | null {
  if (!isObject(value)) return null
  const base = parseBase(value)
  const { name, latitude, longitude, categoryId, note } = value
  if (!base || !isText(name, 200) || !isId(categoryId) || typeof note !== 'string' || note.length > MAX_CAPTURE_LENGTH) return null
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return null
  return { ...base, name: name.trim(), latitude, longitude, categoryId, note }
}

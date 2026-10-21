import type { Checklist, ChecklistItem } from '../types/checklist'
import type { CalendarEvent } from '../types/calendar'
import type { Meeting, MeetingNote } from '../types/meeting'
import type { SyncRecord, WorkspaceData } from '../types/sync'
import type { Capture, Task } from '../types/task'
import { isDateKey, isTimeKey } from './dates'
import type { MapCategory, MapPin } from '../types/map'

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
  if (!base || !isDateKey(date) || !isText(text)) return null
  if (value.repeat != null && value.repeat !== 'yearly') return null
  if (value.category != null && value.category !== 'birthday') return null
  return {
    ...base,
    date,
    text,
    ...(value.repeat !== undefined ? { repeat: value.repeat as 'yearly' | null } : {}),
    ...(value.category !== undefined ? { category: value.category as 'birthday' | null } : {}),
  }
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
    case 'checklist': { const list = parseChecklist(value.value); return list && { type: 'checklist', value: list } }
    case 'checklistItem': { const item = parseChecklistItem(value.value); return item && { type: 'checklistItem', value: item } }
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

export const EMPTY_WORKSPACE: WorkspaceData = { checklists: [], checklistItems: [], captures: [], tasks: [], events: [], meetings: [], meetingNotes: [], mapCategories: [], mapPins: [] }

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
    checklists: applyValues(state.checklists, records.flatMap((record) => record.type === 'checklist' ? [record.value] : [])),
    checklistItems: applyValues(state.checklistItems, records.flatMap((record) => record.type === 'checklistItem' ? [record.value] : [])),
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
  if (!base || !isText(name, 200) || !isId(categoryId) || typeof note !== 'string') return null
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return null
  return { ...base, name: name.trim(), latitude, longitude, categoryId, note }
}

export function parseChecklist(value: unknown): Checklist | null {
  if (!isObject(value)) return null
  const base = parseBase(value)
  if (!base || !isText(value.name, MAX_TITLE_LENGTH)) return null
  return { ...base, name: value.name.trim() }
}

export function parseChecklistItem(value: unknown): ChecklistItem | null {
  if (!isObject(value)) return null
  const base = parseBase(value)
  const completedAt = isoOrNull(value.completedAt ?? null)
  if (!base || !isId(value.listId) || !isText(value.text) || completedAt === undefined) return null
  if (typeof value.position !== 'number' || !Number.isSafeInteger(value.position) || value.position < 0) return null
  return { ...base, listId: value.listId, text: value.text.trim(), position: value.position, completedAt }
}

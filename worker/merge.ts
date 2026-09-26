import type { MeetingNote } from '../src/shared/types/meeting'
import type { SyncRecord } from '../src/shared/types/sync'
import type { Capture, Task } from '../src/shared/types/task'
import type { Suggestion } from './validation'

type Editable = { createdAt: string; updatedAt: string; deletedAt: string | null }
type RecordType = SyncRecord['type']

/**
 * Server rules for an incoming capture. Text is immutable and AI state is server-owned, so the
 * only accepted change to a stored capture is deletion. Returns null when nothing changes.
 */
export function mergeCapture(existing: Capture | null, incoming: Capture): Capture | null {
  if (!existing) return { ...incoming, ai: incoming.deletedAt ? null : 'queued' }
  if (existing.deletedAt || !incoming.deletedAt) return null
  return {
    ...existing,
    deletedAt: incoming.deletedAt,
    updatedAt: incoming.updatedAt > existing.updatedAt ? incoming.updatedAt : existing.updatedAt,
  }
}

/** The most recent edit wins and deletion is final. Returns null when nothing changes. */
export function mergeEdit<T extends Editable>(existing: T | null, incoming: T): T | null {
  if (!existing) return incoming
  if (existing.deletedAt || incoming.updatedAt <= existing.updatedAt) return null
  return { ...incoming, createdAt: existing.createdAt }
}

/** A task follows `mergeEdit`, and its source capture never changes. */
export function mergeTask(existing: Task | null, incoming: Task): Task | null {
  const next = mergeEdit(existing, incoming)
  return next && existing ? { ...next, captureId: existing.captureId } : next
}

/** A meeting note follows `mergeEdit`, and its meeting never changes. */
export function mergeMeetingNote(existing: MeetingNote | null, incoming: MeetingNote): MeetingNote | null {
  const next = mergeEdit(existing, incoming)
  return next && existing ? { ...next, meetingId: existing.meetingId } : next
}

/**
 * Applies an incoming record to the stored record with the same type and id. Returns the record
 * to store, or null when nothing changes.
 */
export function mergeRecord(existing: SyncRecord | null, incoming: SyncRecord): SyncRecord | null {
  switch (incoming.type) {
    case 'capture': {
      const value = mergeCapture(existing?.type === 'capture' ? existing.value : null, incoming.value)
      return value && { type: 'capture', value }
    }
    case 'task': {
      const value = mergeTask(existing?.type === 'task' ? existing.value : null, incoming.value)
      return value && { type: 'task', value }
    }
    case 'event': {
      const value = mergeEdit(existing?.type === 'event' ? existing.value : null, incoming.value)
      return value && { type: 'event', value }
    }
    case 'meeting': {
      const value = mergeEdit(existing?.type === 'meeting' ? existing.value : null, incoming.value)
      return value && { type: 'meeting', value }
    }
    case 'meetingNote': {
      const value = mergeMeetingNote(existing?.type === 'meetingNote' ? existing.value : null, incoming.value)
      return value && { type: 'meetingNote', value }
    }
  }
}

/** Deleting a parent deletes its children: a capture's tasks and a meeting's notes. */
export const CHILD_TYPE: Partial<Record<RecordType, RecordType>> = { capture: 'task', meeting: 'meetingNote' }

/** The record a child belongs to, or null for a record that has no parent. */
export function parentOf(record: SyncRecord): { type: RecordType; id: string } | null {
  if (record.type === 'task') return { type: 'capture', id: record.value.captureId }
  if (record.type === 'meetingNote') return { type: 'meeting', id: record.value.meetingId }
  return null
}

/** The record, deleted at `at`. Its edit time never moves backwards, so the deletion wins everywhere. */
export function deletedRecord(record: SyncRecord, at: string): SyncRecord {
  const deleted = <T extends Editable>(value: T): T => ({ ...value, deletedAt: at, updatedAt: at > value.updatedAt ? at : value.updatedAt })
  switch (record.type) {
    case 'capture':
      return { type: 'capture', value: deleted(record.value) }
    case 'task':
      return { type: 'task', value: deleted(record.value) }
    case 'event':
      return { type: 'event', value: deleted(record.value) }
    case 'meeting':
      return { type: 'meeting', value: deleted(record.value) }
    case 'meetingNote':
      return { type: 'meetingNote', value: deleted(record.value) }
  }
}

/**
 * Suggestion ids are stable per capture so a retry never duplicates a draft. They carry the
 * capture's own timestamps, so any later edit from a device wins under `mergeTask`.
 */
export function suggestionTask(capture: Capture, suggestion: Suggestion, index: number): Task {
  return {
    id: `${capture.id}:s${index}`,
    captureId: capture.id,
    title: suggestion.title,
    dueAt: suggestion.dueAt,
    reminderAt: suggestion.reminderAt,
    pinned: false,
    completedAt: null,
    suggestionStatus: 'suggested',
    createdAt: capture.createdAt,
    updatedAt: capture.createdAt,
    deletedAt: null,
  }
}

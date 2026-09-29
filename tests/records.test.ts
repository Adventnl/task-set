import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../src/shared/types/calendar'
import type { Meeting, MeetingNote } from '../src/shared/types/meeting'
import type { Capture, Task } from '../src/shared/types/task'
import {
  EMPTY_WORKSPACE,
  fitsInStorage,
  MAX_PUSH_BYTES,
  MAX_RECORD_BYTES,
  MAX_TITLE_LENGTH,
  mergeRecords,
  parseCapture,
  parseEvent,
  parseMeeting,
  parseMeetingNote,
  parseSyncRecord,
  parseTask,
  RecordTooLargeError,
  recordBytes,
  takeWithinBytes,
} from '../src/shared/utils/records'
import { AUTOMATIC_BATCH, deletedRecord, mergeCapture, mergeRecord, mergeTask, parentOf, suggestionTask } from '../worker/merge'

const capture: Capture = {
  id: 'c1',
  kind: 'voice',
  text: 'Change the Cloudflare email tomorrow morning',
  timeZone: 'Europe/London',
  createdAt: '2026-09-25T22:00:00.000Z',
  updatedAt: '2026-09-25T22:00:00.000Z',
  deletedAt: null,
  ai: null,
}

const task: Task = {
  id: 't1',
  captureId: 'c1',
  title: 'Change the Cloudflare email',
  createdAt: '2026-09-25T22:00:00.000Z',
  updatedAt: '2026-09-25T22:00:00.000Z',
  deletedAt: null,
  dueAt: null,
  reminderAt: '2026-09-26T08:00:00.000Z',
  pinned: false,
  completedAt: null,
  suggestionStatus: null,
}

const event: CalendarEvent = {
  id: 'e1',
  date: '2026-09-28',
  text: 'Dentist',
  createdAt: '2026-09-25T22:00:00.000Z',
  updatedAt: '2026-09-25T22:00:00.000Z',
  deletedAt: null,
}

const meeting: Meeting = {
  id: 'm1',
  title: 'Team sync',
  date: '2026-09-28',
  time: '10:00',
  repeat: 'weekly',
  createdAt: '2026-09-25T22:00:00.000Z',
  updatedAt: '2026-09-25T22:00:00.000Z',
  deletedAt: null,
}

const note: MeetingNote = {
  id: 'n1',
  meetingId: 'm1',
  date: '2026-09-28',
  text: 'Ask about the budget',
  createdAt: '2026-09-25T22:00:00.000Z',
  updatedAt: '2026-09-25T22:00:00.000Z',
  deletedAt: null,
}

describe('record validation', () => {
  it('accepts well-formed records and normalizes timestamps', () => {
    expect(parseCapture({ ...capture, createdAt: '2026-09-25T22:00:00Z' })?.createdAt).toBe('2026-09-25T22:00:00.000Z')
    expect(parseTask(task)).toEqual(task)
    expect(parseSyncRecord({ type: 'task', value: task })).toEqual({ type: 'task', value: task })
  })

  it('rejects malformed records at the boundary', () => {
    expect(parseCapture({ ...capture, text: '   ' })).toBeNull()
    expect(parseCapture({ ...capture, timeZone: 'Mars/Olympus' })).toBeNull()
    expect(parseCapture({ ...capture, id: 'has spaces' })).toBeNull()
    expect(parseCapture({ ...capture, ai: 'thinking' })).toBeNull()
    expect(parseTask({ ...task, dueAt: 'tomorrow' })).toBeNull()
    expect(parseTask({ ...task, pinned: 'yes' })).toBeNull()
    expect(parseSyncRecord({ type: 'note', value: task })).toBeNull()
  })

  it('accepts calendar events, meetings, and meeting notes', () => {
    expect(parseEvent(event)).toEqual(event)
    expect(parseMeeting(meeting)).toEqual(meeting)
    expect(parseMeeting({ ...meeting, time: undefined, repeat: undefined })).toEqual({ ...meeting, time: null, repeat: null })
    expect(parseMeetingNote(note)).toEqual(note)
    expect(parseSyncRecord({ type: 'meetingNote', value: note })).toEqual({ type: 'meetingNote', value: note })
  })

  it('puts no length limit on notes, calendar entries, or meeting notes', () => {
    const long = 'word '.repeat(200_000) // a million characters
    expect(parseCapture({ ...capture, text: long })?.text).toBe(long)
    expect(parseEvent({ ...event, text: long })?.text).toBe(long)
    expect(parseMeetingNote({ ...note, text: long })?.text).toBe(long)
    expect(parseSyncRecord({ type: 'capture', value: { ...capture, text: long } })).not.toBeNull()
  })

  it('keeps titles to one short line', () => {
    expect(parseTask({ ...task, title: 'x'.repeat(MAX_TITLE_LENGTH) })).not.toBeNull()
    expect(parseTask({ ...task, title: 'x'.repeat(MAX_TITLE_LENGTH + 1) })).toBeNull()
  })

  it('rejects impossible days, times, and repeats', () => {
    expect(parseEvent({ ...event, date: '2026-02-30' })).toBeNull()
    expect(parseEvent({ ...event, text: ' ' })).toBeNull()
    expect(parseMeeting({ ...meeting, time: '25:00' })).toBeNull()
    expect(parseMeeting({ ...meeting, repeat: 'daily' })).toBeNull()
    expect(parseMeeting({ ...meeting, title: 'x'.repeat(201) })).toBeNull()
    expect(parseMeetingNote({ ...note, meetingId: 'has spaces' })).toBeNull()
  })

  it('merges changes into the on-screen snapshot and removes deletions', () => {
    const state = mergeRecords(EMPTY_WORKSPACE, [
      { type: 'capture', value: capture },
      { type: 'task', value: task },
    ])
    expect(state.tasks).toHaveLength(1)
    const next = mergeRecords(state, [{ type: 'task', value: { ...task, deletedAt: '2026-09-26T00:00:00.000Z' } }])
    expect(next.tasks).toHaveLength(0)
    expect(next.captures).toEqual([capture])
  })

  it('keeps every record type in its own list and leaves untouched lists as they were', () => {
    const state = mergeRecords(EMPTY_WORKSPACE, [
      { type: 'event', value: event },
      { type: 'meeting', value: meeting },
      { type: 'meetingNote', value: note },
    ])
    expect(state).toMatchObject({ events: [event], meetings: [meeting], meetingNotes: [note] })
    expect(state.captures).toBe(EMPTY_WORKSPACE.captures)
    const next = mergeRecords(state, [{ type: 'event', value: { ...event, deletedAt: '2026-09-26T00:00:00.000Z' } }])
    expect(next.events).toEqual([])
    expect(next.meetings).toBe(state.meetings)
  })
})

describe('record size', () => {
  const capture$ = (text: string) => ({ type: 'capture' as const, value: { ...capture, text } })

  it('measures a record as stored: JSON in UTF-8 bytes, so multi-byte text counts in full', () => {
    const overhead = recordBytes(capture$(''))
    expect(recordBytes(capture$('a'.repeat(10)))).toBe(overhead + 10)
    expect(recordBytes(capture$('汉'.repeat(10)))).toBe(overhead + 30)
    expect(recordBytes(capture$('\n'.repeat(10)))).toBe(overhead + 20) // a newline is two characters in JSON
  })

  it('accepts a record up to the storage limit and refuses one over it', () => {
    const room = MAX_RECORD_BYTES - recordBytes(capture$(''))
    expect(fitsInStorage(capture$('a'.repeat(room)))).toBe(true)
    expect(fitsInStorage(capture$('a'.repeat(room + 1)))).toBe(false)
    expect(fitsInStorage(capture$('汉'.repeat(Math.floor(room / 3) + 1)))).toBe(false)
  })

  it('lets one push carry the largest record with its JSON envelope', () => {
    const largest = capture$('a'.repeat(MAX_RECORD_BYTES - recordBytes(capture$(''))))
    const body = JSON.stringify({ records: [largest] })
    expect(new TextEncoder().encode(body).byteLength).toBeLessThanOrEqual(MAX_PUSH_BYTES)
  })

  it('explains what to do about a record that is too large', () => {
    expect(new RecordTooLargeError().message).toMatch(/too large.*1\.9 MB.*split it/i)
  })
})

describe('taking a run within a byte budget', () => {
  const size = (item: number) => item

  it('takes items from the start while they fit, and says more was left', () => {
    expect(takeWithinBytes([40, 40, 40, 40], size, 100)).toEqual({ taken: [40, 40], more: true })
    expect(takeWithinBytes([40, 40, 20], size, 100)).toEqual({ taken: [40, 40, 20], more: false })
    expect(takeWithinBytes([], size, 100)).toEqual({ taken: [], more: false })
  })

  it('always takes the first item, so one large record still goes through alone', () => {
    expect(takeWithinBytes([500, 1, 1], size, 100)).toEqual({ taken: [500], more: true })
    expect(takeWithinBytes([500], size, 100)).toEqual({ taken: [500], more: false })
  })

  it('never lets a large item share a run it would overflow', () => {
    expect(takeWithinBytes([10, 95, 10], size, 100)).toEqual({ taken: [10], more: true })
  })

  it('also stops at a count', () => {
    expect(takeWithinBytes([1, 1, 1, 1], size, 100, 3)).toEqual({ taken: [1, 1, 1], more: true })
    expect(takeWithinBytes([1, 1, 1], size, 100, 3)).toEqual({ taken: [1, 1, 1], more: false })
  })

  it('reads a lazy source only as far as it needs, as a database cursor should be', () => {
    let read = 0
    function* rows() {
      for (let row = 0; row < 1000; row++) {
        read++
        yield 60
      }
    }
    expect(takeWithinBytes(rows(), size, 100).taken).toEqual([60])
    expect(read).toBe(2) // the row that did not fit is the last one read
  })
})

describe('server merge rules', () => {
  it('queues voice notes and explicit commands, and never changes a note’s text afterwards', () => {
    const typed = { ...capture, kind: 'text' as const }
    const stored = mergeCapture(null, typed)
    expect(stored?.ai).toBe('ready')
    expect(mergeCapture(stored, { ...typed, text: 'Rewritten' })).toBeNull()
    expect(mergeCapture(null, { ...typed, text: 'Generate task: Email Sam' })?.ai).toBe('queued')
    expect(mergeCapture(null, { ...typed, text: 'Email Sam', ai: 'queued' })?.ai).toBe('ready')
    expect(mergeCapture(null, capture)?.ai).toBe('queued')
  })

  it('accepts deletion of a capture once', () => {
    const stored = mergeCapture(null, capture)
    const deleted = mergeCapture(stored, { ...capture, deletedAt: '2026-09-26T00:00:00.000Z', updatedAt: '2026-09-26T00:00:00.000Z' })
    expect(deleted?.deletedAt).toBe('2026-09-26T00:00:00.000Z')
    expect(deleted?.ai).toBe('queued')
    expect(mergeCapture(deleted, { ...capture, deletedAt: '2026-09-27T00:00:00.000Z' })).toBeNull()
  })

  it('lets the most recent task edit win and keeps deletions final', () => {
    const newer = { ...task, title: 'Newer', updatedAt: '2026-09-26T10:00:00.000Z' }
    const older = { ...task, title: 'Older', updatedAt: '2026-09-26T09:00:00.000Z' }
    expect(mergeTask(newer, older)).toBeNull()
    expect(mergeTask(older, newer)?.title).toBe('Newer')
    expect(mergeTask(older, { ...newer, captureId: 'other' })?.captureId).toBe('c1')
    const gone = deletedRecord({ type: 'task', value: newer }, '2026-09-26T11:00:00.000Z').value as Task
    expect(mergeTask(gone, { ...newer, updatedAt: '2026-09-27T00:00:00.000Z' })).toBeNull()
  })

  it('applies the same rules to events, meetings, and meeting notes', () => {
    const later = '2026-09-26T10:00:00.000Z'
    const stored = { type: 'meeting' as const, value: meeting }
    expect(mergeRecord(null, stored)).toEqual(stored)
    expect(mergeRecord(stored, { type: 'meeting', value: { ...meeting, title: 'Weekly sync', updatedAt: later } })?.value).toMatchObject({ title: 'Weekly sync' })
    expect(mergeRecord(stored, { type: 'meeting', value: { ...meeting, title: 'Stale' } })).toBeNull()
    const moved = mergeRecord({ type: 'meetingNote', value: note }, { type: 'meetingNote', value: { ...note, meetingId: 'm2', updatedAt: later } })
    expect(moved?.value).toMatchObject({ meetingId: 'm1' })
    const deleted = deletedRecord({ type: 'event', value: event }, later)
    expect(mergeRecord(deleted, { type: 'event', value: { ...event, updatedAt: '2026-09-27T00:00:00.000Z' } })).toBeNull()
  })

  it('links children to their parents so deletions cascade', () => {
    expect(parentOf({ type: 'task', value: task })).toEqual({ type: 'capture', id: 'c1' })
    expect(parentOf({ type: 'meetingNote', value: note })).toEqual({ type: 'meeting', id: 'm1' })
    expect(parentOf({ type: 'event', value: event })).toBeNull()
  })

  it('never moves an edit time backwards when deleting', () => {
    const edited = { ...note, updatedAt: '2026-09-27T00:00:00.000Z' }
    expect(deletedRecord({ type: 'meetingNote', value: edited }, '2026-09-26T00:00:00.000Z').value).toMatchObject({
      deletedAt: '2026-09-26T00:00:00.000Z',
      updatedAt: '2026-09-27T00:00:00.000Z',
    })
  })

  it('gives suggestions stable ids that any later edit overrides', () => {
    const draft = suggestionTask(capture, { title: 'Change the Cloudflare email', dueAt: null, reminderAt: null }, AUTOMATIC_BATCH, 0, 'suggest')
    expect(draft).toMatchObject({ id: 'c1:s0', suggestionStatus: 'suggested' })
    expect(parseTask(draft)).toEqual(draft)
    const accepted = { ...draft, suggestionStatus: null, updatedAt: '2026-09-25T22:00:05.000Z' }
    expect(mergeTask(draft, accepted)?.suggestionStatus).toBeNull()
  })

  it('puts requested tasks directly in Tasks, with ids per request', () => {
    const generated = suggestionTask({ ...capture, text: 'Generate task: Email Sam' }, { title: 'Email Sam', dueAt: null, reminderAt: null }, AUTOMATIC_BATCH, 0, 'create')
    expect(generated).toMatchObject({ id: 'c1:s0', captureId: 'c1', suggestionStatus: null })
    expect(parseTask(generated)).toEqual(generated)
    const requested = suggestionTask(capture, { title: 'Email Sam', dueAt: null, reminderAt: null }, 'gmg0abcd-', 1, 'create')
    expect(requested).toMatchObject({ id: 'c1:gmg0abcd-1', suggestionStatus: null })
    expect(parseTask(requested)).toEqual(requested)
  })
})

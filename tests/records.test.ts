import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../src/shared/types/calendar'
import type { Meeting, MeetingNote } from '../src/shared/types/meeting'
import type { Capture, Task } from '../src/shared/types/task'
import { EMPTY_WORKSPACE, mergeRecords, parseCapture, parseEvent, parseMeeting, parseMeetingNote, parseSyncRecord, parseTask } from '../src/shared/utils/records'
import { deletedRecord, mergeCapture, mergeRecord, mergeTask, parentOf, suggestionTask } from '../worker/merge'

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

describe('server merge rules', () => {
  it('queues a new capture for AI and never changes its text afterwards', () => {
    const stored = mergeCapture(null, capture)
    expect(stored?.ai).toBe('queued')
    expect(mergeCapture(stored, { ...capture, text: 'Rewritten' })).toBeNull()
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
    const draft = suggestionTask(capture, { title: 'Change the Cloudflare email', dueAt: null, reminderAt: null }, 0)
    expect(draft.id).toBe('c1:s0')
    expect(parseTask(draft)).toEqual(draft)
    const accepted = { ...draft, suggestionStatus: null, updatedAt: '2026-09-25T22:00:05.000Z' }
    expect(mergeTask(draft, accepted)?.suggestionStatus).toBeNull()
  })
})

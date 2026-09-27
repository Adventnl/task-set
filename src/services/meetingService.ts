import type { Meeting, MeetingInput, MeetingNote } from '../shared/types/meeting'
import type { SyncRecord } from '../shared/types/sync'
import { markDeleted } from '../shared/utils/records'
import { createId, saveLocal } from './localDataService'

// Meetings and their notes save on this device first, like every other change, and sync afterwards.

const meetingRecord = (value: Meeting): SyncRecord => ({ type: 'meeting', value })
const noteRecord = (value: MeetingNote): SyncRecord => ({ type: 'meetingNote', value })

/** Creates a meeting when `meeting` is null; otherwise saves the edit. */
export function saveMeeting(meeting: Meeting | null, input: MeetingInput): Promise<SyncRecord[]> {
  const now = new Date().toISOString()
  const value: Meeting = meeting
    ? { ...meeting, ...input, updatedAt: now }
    : { id: createId(), ...input, createdAt: now, updatedAt: now, deletedAt: null }
  return saveLocal([meetingRecord(value)])
}

/** Deletes a meeting together with all of its notes, in one local save. */
export function deleteMeeting(meeting: Meeting, notes: MeetingNote[]): Promise<SyncRecord[]> {
  const now = new Date().toISOString()
  return saveLocal([
    meetingRecord(markDeleted(meeting, now)),
    ...notes.filter((note) => note.meetingId === meeting.id).map((note) => noteRecord(markDeleted(note, now))),
  ])
}

export function addMeetingNote(meetingId: string, date: string, text: string): Promise<SyncRecord[]> {
  const now = new Date().toISOString()
  return saveLocal([noteRecord({ id: createId(), meetingId, date, text, createdAt: now, updatedAt: now, deletedAt: null })])
}

export function deleteMeetingNote(note: MeetingNote): Promise<SyncRecord[]> {
  return saveLocal([noteRecord(markDeleted(note, new Date().toISOString()))])
}

import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createEvent, deleteEvent, saveEvent } from '../src/services/calendarService'
import { clearLocalData, loadData, readOutbox } from '../src/services/localDataService'
import { addMeetingNote, deleteMeeting, saveMeeting } from '../src/services/meetingService'
import type { CalendarEvent } from '../src/shared/types/calendar'
import type { Meeting, MeetingNote } from '../src/shared/types/meeting'

const input = { title: 'Team sync', date: '2026-09-28', time: '10:00', repeat: 'weekly' as const }

describe('calendar events', () => {
  beforeEach(() => clearLocalData())

  it('adds, moves, and deletes an event on this device, queued for sync', async () => {
    const [created] = await createEvent({ date: '2026-09-28', text: 'Dentist' })
    const event = created.value as CalendarEvent
    expect(event).toMatchObject({ date: '2026-09-28', text: 'Dentist', deletedAt: null })
    const [moved] = await saveEvent(event, { date: '2026-09-29', text: 'Dentist at 3' })
    expect((await loadData()).events).toEqual([moved.value])
    await deleteEvent(moved.value as CalendarEvent)
    expect((await loadData()).events).toEqual([])
    expect((await readOutbox(10)).map((entry) => [entry.key, !!entry.record.value.deletedAt])).toEqual([[`event:${event.id}`, true]])
  })
})

describe('meetings', () => {
  beforeEach(() => clearLocalData())

  it('creates a meeting, then edits it without changing its id or creation time', async () => {
    const [created] = await saveMeeting(null, input)
    const meeting = created.value as Meeting
    const [edited] = await saveMeeting(meeting, { ...input, time: null, repeat: null })
    expect(edited.value).toMatchObject({ id: meeting.id, createdAt: meeting.createdAt, time: null, repeat: null })
    expect((await loadData()).meetings).toEqual([edited.value])
  })

  it('deletes a meeting with its notes, and leaves other meetings’ notes alone', async () => {
    const meeting = (await saveMeeting(null, input))[0].value as Meeting
    const other = (await saveMeeting(null, { ...input, title: 'One to one' }))[0].value as Meeting
    const [first] = await addMeetingNote(meeting.id, '2026-09-28', 'Ask about the budget')
    const [kept] = await addMeetingNote(other.id, '2026-09-28', 'Career plans')
    const notes = [first.value, kept.value] as MeetingNote[]

    const records = await deleteMeeting(meeting, notes)
    expect(records.map((record) => `${record.type}:${record.value.id}`)).toEqual([`meeting:${meeting.id}`, `meetingNote:${first.value.id}`])
    const left = await loadData()
    expect(left.meetings.map(({ id }) => id)).toEqual([other.id])
    expect(left.meetingNotes).toEqual([kept.value])
  })
})

import type { Meeting, MeetingNote } from '../types/meeting'
import { addDays, daysBetween, localDate, longDayLabel, timeOfDayLabel } from './dates'

const WEEK = 7

export interface MeetingSummary {
  meeting: Meeting
  /** The next meeting day, or the day of a one-off meeting that has passed. */
  date: string
  upcoming: boolean
  /** Notes written for that day. */
  noteCount: number
}

export interface MeetingSection {
  id: 'upcoming' | 'past'
  label: string
  items: MeetingSummary[]
}

export interface MeetingDetail {
  /** The meeting day on screen. */
  date: string
  /** The next meeting day, or null once a one-off meeting has passed. */
  next: string | null
  previous: string | null
  following: string | null
  notes: MeetingNote[]
  /** Other days with notes, latest first. */
  otherDays: { date: string; count: number }[]
}

/** The meeting's first day on or after `from`, or null once a one-off meeting has passed. */
export function nextMeetingDate(meeting: Meeting, from: string): string | null {
  const behind = daysBetween(meeting.date, from)
  if (behind <= 0) return meeting.date
  return meeting.repeat ? addDays(meeting.date, Math.ceil(behind / WEEK) * WEEK) : null
}

/** Every day the meeting happens from `start` to `end`, inclusive. */
export function meetingDates(meeting: Meeting, start: string, end: string): string[] {
  const first = nextMeetingDate(meeting, start)
  if (!first || first > end) return []
  if (!meeting.repeat) return [first]
  const dates: string[] = []
  for (let date = first; date <= end; date = addDays(date, WEEK)) dates.push(date)
  return dates
}

/** The meeting day just after (`step` 1) or before (-1) `date`, or null when there is none. */
export function adjacentMeetingDate(meeting: Meeting, date: string, step: 1 | -1): string | null {
  if (step === 1) return nextMeetingDate(meeting, addDays(date, 1))
  const since = daysBetween(meeting.date, addDays(date, -1))
  if (since < 0) return null
  return meeting.repeat ? addDays(meeting.date, Math.floor(since / WEEK) * WEEK) : meeting.date
}

/** "Every Monday at 10:00 AM", or the day of a one-off meeting. */
export function scheduleLabel(meeting: Pick<Meeting, 'date' | 'time' | 'repeat'>, today: string): string {
  const at = meeting.time ? ` at ${timeOfDayLabel(meeting.time)}` : ''
  if (!meeting.repeat) return `${longDayLabel(meeting.date, today)}${at}`
  return `Every ${new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(localDate(meeting.date))}${at}`
}

/** Counts notes per meeting day. */
export function noteCounter(notes: MeetingNote[]): (meetingId: string, date: string) => number {
  const counts = new Map<string, number>()
  for (const note of notes) {
    const key = `${note.meetingId} ${note.date}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return (meetingId, date) => counts.get(`${meetingId} ${date}`) ?? 0
}

function byWhen(a: MeetingSummary, b: MeetingSummary): number {
  return a.date.localeCompare(b.date) || (a.meeting.time ?? '').localeCompare(b.meeting.time ?? '') || a.meeting.title.localeCompare(b.meeting.title)
}

/** Upcoming meetings, soonest first, then one-off meetings that have passed, latest first. */
export function meetingSections(meetings: Meeting[], notes: MeetingNote[], today: string): MeetingSection[] {
  const count = noteCounter(notes)
  const summaries = meetings.map((meeting): MeetingSummary => {
    const next = nextMeetingDate(meeting, today)
    const date = next ?? meeting.date
    return { meeting, date, upcoming: next !== null, noteCount: count(meeting.id, date) }
  })
  const sections: MeetingSection[] = [
    { id: 'upcoming', label: 'Upcoming', items: summaries.filter((item) => item.upcoming).sort(byWhen) },
    { id: 'past', label: 'Past', items: summaries.filter((item) => !item.upcoming).sort((a, b) => byWhen(b, a)) },
  ]
  return sections.filter((section) => section.items.length)
}

/** One meeting's day and notes. With no day picked, it shows the next meeting. */
export function meetingDetail(meeting: Meeting, notes: MeetingNote[], picked: string | null, today: string): MeetingDetail {
  const next = nextMeetingDate(meeting, today)
  const date = picked ?? next ?? meeting.date
  const own = notes.filter((note) => note.meetingId === meeting.id)
  const others = new Map<string, number>()
  for (const note of own) if (note.date !== date) others.set(note.date, (others.get(note.date) ?? 0) + 1)
  return {
    date,
    next,
    previous: adjacentMeetingDate(meeting, date, -1),
    following: adjacentMeetingDate(meeting, date, 1),
    notes: own.filter((note) => note.date === date),
    otherDays: [...others].map(([day, count]) => ({ date: day, count })).sort((a, b) => b.date.localeCompare(a.date)),
  }
}

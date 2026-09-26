import { describe, expect, it } from 'vitest'
import type { Meeting, MeetingNote } from '../src/shared/types/meeting'
import { adjacentMeetingDate, meetingDates, meetingDetail, meetingSections, nextMeetingDate } from '../src/shared/utils/meetingView'

const stamp = '2026-09-01T00:00:00.000Z'
const meeting = (overrides: Partial<Meeting> = {}): Meeting => ({
  id: 'weekly',
  title: 'Team sync',
  date: '2026-09-07',
  time: '10:00',
  repeat: 'weekly',
  createdAt: stamp,
  updatedAt: stamp,
  deletedAt: null,
  ...overrides,
})
const note = (id: string, date: string, meetingId = 'weekly'): MeetingNote => ({
  id,
  meetingId,
  date,
  text: `Note ${id}`,
  createdAt: stamp,
  updatedAt: stamp,
  deletedAt: null,
})

describe('meeting days', () => {
  const weekly = meeting()
  const once = meeting({ id: 'once', date: '2026-10-02', repeat: null })

  it('finds the next meeting, counting today’s as next until the day ends', () => {
    expect(nextMeetingDate(weekly, '2026-09-26')).toBe('2026-09-28')
    expect(nextMeetingDate(weekly, '2026-09-28')).toBe('2026-09-28')
    expect(nextMeetingDate(weekly, '2026-09-01')).toBe('2026-09-07')
    expect(nextMeetingDate(once, '2026-09-26')).toBe('2026-10-02')
    expect(nextMeetingDate(once, '2026-10-03')).toBeNull()
  })

  it('lists the days in a range', () => {
    expect(meetingDates(weekly, '2026-09-01', '2026-09-30')).toEqual(['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'])
    expect(meetingDates(once, '2026-09-01', '2026-09-30')).toEqual([])
    expect(meetingDates(once, '2026-10-01', '2026-10-31')).toEqual(['2026-10-02'])
  })

  it('steps a week at a time, never before the first meeting', () => {
    expect(adjacentMeetingDate(weekly, '2026-09-28', 1)).toBe('2026-10-05')
    expect(adjacentMeetingDate(weekly, '2026-09-28', -1)).toBe('2026-09-21')
    expect(adjacentMeetingDate(weekly, '2026-09-07', -1)).toBeNull()
    // A day that is not a meeting day, such as one whose meeting moved, steps to the nearest ones.
    expect(adjacentMeetingDate(weekly, '2026-09-24', -1)).toBe('2026-09-21')
    expect(adjacentMeetingDate(weekly, '2026-09-24', 1)).toBe('2026-09-28')
    expect(adjacentMeetingDate(once, '2026-10-02', 1)).toBeNull()
    expect(adjacentMeetingDate(once, '2026-10-02', -1)).toBeNull()
  })
})

describe('meeting lists', () => {
  const meetings = [
    meeting(),
    meeting({ id: 'soon', title: 'Interview', date: '2026-09-27', time: null, repeat: null }),
    meeting({ id: 'old', title: 'Kickoff', date: '2026-09-02', repeat: null }),
    meeting({ id: 'older', title: 'Planning', date: '2026-08-20', repeat: null }),
  ]
  const notes = [note('n1', '2026-09-28'), note('n2', '2026-09-21'), note('n3', '2026-09-28'), note('other', '2026-09-28', 'soon')]

  it('puts upcoming meetings soonest first, then past ones latest first, with notes for the next one', () => {
    const sections = meetingSections(meetings, notes, '2026-09-26')
    expect(sections.map((section) => [section.id, section.items.map((item) => [item.meeting.id, item.date, item.noteCount])])).toEqual([
      [
        'upcoming',
        [
          ['soon', '2026-09-27', 0],
          ['weekly', '2026-09-28', 2],
        ],
      ],
      [
        'past',
        [
          ['old', '2026-09-02', 0],
          ['older', '2026-08-20', 0],
        ],
      ],
    ])
    expect(meetingSections([], [], '2026-09-26')).toEqual([])
  })

  it('opens on the next meeting and lists other days with notes, latest first', () => {
    const detail = meetingDetail(meeting(), notes, null, '2026-09-26')
    expect(detail).toMatchObject({ date: '2026-09-28', next: '2026-09-28', previous: '2026-09-21', following: '2026-10-05' })
    expect(detail.notes.map(({ id }) => id)).toEqual(['n1', 'n3'])
    expect(detail.otherDays).toEqual([{ date: '2026-09-21', count: 1 }])
  })

  it('opens a picked day, and a past one-off meeting on its own day', () => {
    expect(meetingDetail(meeting(), notes, '2026-09-21', '2026-09-26')).toMatchObject({ date: '2026-09-21', next: '2026-09-28' })
    const past = meetingDetail(meetings[2], [], null, '2026-09-26')
    expect(past).toMatchObject({ date: '2026-09-02', next: null, previous: null, following: null })
  })
})

import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../src/shared/types/calendar'
import type { Meeting, MeetingNote } from '../src/shared/types/meeting'
import type { Task } from '../src/shared/types/task'
import { calendarItems, firstDayOfWeek, monthWeeks, upcomingEvents } from '../src/shared/utils/calendarView'
import { addDays, addMonths, countdownLabel, daysBetween, isDateKey, isTimeKey, monthStart, weekdayOf } from '../src/shared/utils/dates'

const stamp = '2026-09-20T00:00:00.000Z'
const event = (id: string, date: string): CalendarEvent => ({ id, date, text: `Event ${id}`, createdAt: stamp, updatedAt: stamp, deletedAt: null })
const meeting = (overrides: Partial<Meeting> = {}): Meeting => ({
  id: 'm1',
  title: 'Team sync',
  date: '2026-09-07',
  time: '10:00',
  repeat: 'weekly',
  createdAt: stamp,
  updatedAt: stamp,
  deletedAt: null,
  ...overrides,
})
const task = (overrides: Partial<Task> = {}): Task => ({
  id: 't1',
  captureId: 'c1',
  title: 'Pay rent',
  createdAt: stamp,
  updatedAt: stamp,
  deletedAt: null,
  dueAt: null,
  reminderAt: null,
  pinned: false,
  completedAt: null,
  suggestionStatus: null,
  ...overrides,
})

describe('date keys', () => {
  it('accepts only real calendar dates and 24-hour times', () => {
    expect(isDateKey('2026-02-28')).toBe(true)
    expect(isDateKey('2028-02-29')).toBe(true)
    expect(isDateKey('2026-02-29')).toBe(false)
    expect(isDateKey('2026-9-28')).toBe(false)
    expect(isDateKey('0999-01-01')).toBe(false)
    expect(isTimeKey('23:59')).toBe(true)
    expect(isTimeKey('24:00')).toBe(false)
    expect(isTimeKey('9:00')).toBe(false)
  })

  it('counts days and months without meeting daylight-saving changes', () => {
    // Clocks change in late October and late March in many zones; date keys never notice.
    expect(daysBetween('2026-10-20', '2026-11-03')).toBe(14)
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01')
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-01')
    expect(monthStart('2026-09-26')).toBe('2026-09-01')
    expect(weekdayOf('2026-09-26')).toBe(6)
  })

  it('says how far away a day is', () => {
    expect([0, 1, 4, -1, -3].map(countdownLabel)).toEqual(['Today', 'Tomorrow', 'In 4 days', 'Yesterday', '3 days ago'])
  })
})

describe('month grid', () => {
  it('starts weeks on the locale’s first day and falls back to Monday', () => {
    expect(firstDayOfWeek('en-US')).toBe(0)
    expect(firstDayOfWeek('en-NZ')).toBe(1)
    expect(firstDayOfWeek('')).toBe(1)
  })

  it('covers the whole month in full weeks', () => {
    const weeks = monthWeeks('2026-09-26', 1)
    expect(weeks).toHaveLength(5)
    expect(weeks[0][0]).toBe('2026-08-31')
    expect(weeks.at(-1)?.at(-1)).toBe('2026-10-04')
    expect(weeks.every((week) => week.length === 7 && weekdayOf(week[0]) === 1)).toBe(true)
    // March 2026 starts on a Sunday and has 31 days: six Monday weeks.
    expect(monthWeeks('2026-03-10', 1)).toHaveLength(6)
    // February 2026 starts on a Sunday and has 28 days: exactly four Sunday weeks.
    expect(monthWeeks('2026-02-10', 0)).toHaveLength(4)
  })
})

describe('calendar items', () => {
  const notes: MeetingNote[] = [
    { id: 'n1', meetingId: 'm1', date: '2026-09-28', text: 'Budget', createdAt: stamp, updatedAt: stamp, deletedAt: null },
    { id: 'n2', meetingId: 'm1', date: '2026-09-28', text: 'Hiring', createdAt: stamp, updatedAt: stamp, deletedAt: null },
  ]
  const data = {
    events: [event('e1', '2026-09-28'), event('far', '2026-11-01')],
    meetings: [meeting(), meeting({ id: 'untimed', title: 'Retro', time: null, repeat: null, date: '2026-09-28' })],
    meetingNotes: notes,
    tasks: [
      task({ id: 'due', dueAt: new Date(2026, 8, 28, 17).toISOString() }),
      task({ id: 'early', reminderAt: new Date(2026, 8, 28, 8).toISOString() }),
      task({ id: 'done', dueAt: new Date(2026, 8, 28, 9).toISOString(), completedAt: stamp }),
      task({ id: 'draft', dueAt: new Date(2026, 8, 28, 9).toISOString(), suggestionStatus: 'suggested' }),
      task({ id: 'undated' }),
    ],
  }

  it('lists a day’s events, then meetings and open tasks by time', () => {
    const day = calendarItems(data, '2026-09-28', '2026-09-28').get('2026-09-28') ?? []
    expect(day.map((item) => item.id)).toEqual(['e1', 'untimed 2026-09-28', 'early', 'm1 2026-09-28', 'due'])
    expect(day.find((item) => item.kind === 'meeting' && item.meeting.id === 'm1')).toMatchObject({ noteCount: 2 })
  })

  it('repeats weekly meetings and keeps everything inside the range', () => {
    const items = calendarItems(data, '2026-08-31', '2026-10-04')
    const meetingDays = [...items].filter(([, list]) => list.some((item) => item.id.startsWith('m1 '))).map(([date]) => date)
    expect(meetingDays.sort()).toEqual(['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'])
    expect(items.has('2026-11-01')).toBe(false)
  })

  it('counts down to upcoming events, soonest first, leaving out past ones', () => {
    const events = [event('later', '2026-10-01'), event('past', '2026-09-25'), event('today', '2026-09-26')]
    expect(upcomingEvents(events, '2026-09-26').map(({ event: { id }, days }) => [id, days])).toEqual([
      ['today', 0],
      ['later', 5],
    ])
  })
})

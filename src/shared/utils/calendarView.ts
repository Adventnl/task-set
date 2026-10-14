import type { CalendarEvent } from '../types/calendar'
import type { Meeting, MeetingNote } from '../types/meeting'
import type { Task } from '../types/task'
import { addDays, addMonths, dateKey, daysBetween, localDate, monthStart, timeKey, weekdayOf } from './dates'
import { meetingDates, noteCounter } from './meetingView'
import { isOpenTask, taskWhen } from './taskView'
import { isDateKey } from './dates'
import { nzHolidays, type Holiday, type NzRegion } from './nzHolidays'

/** Something shown on a calendar day. `id` is unique within the day. */
export type CalendarItem =
  | { kind: 'holiday'; id: string; holiday: Holiday }
  | { kind: 'event'; id: string; event: CalendarEvent }
  | { kind: 'meeting'; id: string; meeting: Meeting; date: string; noteCount: number }
  | { kind: 'task'; id: string; task: Task }

export interface UpcomingEvent {
  event: CalendarEvent
  /** Whole days from today: 0 today. */
  days: number
}

/** Coming up on the home page shows this many of the soonest events. */
export const COMING_UP_COUNT = 3
/** 1 January 2023 was a Sunday. */
const A_SUNDAY = '2023-01-01'

type WeekInfo = { firstDay: number }

/** The locale's first day of the week, 0 Sunday … 6 Saturday; Monday when the browser cannot say. */
export function firstDayOfWeek(locale: string): number {
  try {
    const info = new Intl.Locale(locale) as Intl.Locale & { getWeekInfo?: () => WeekInfo; weekInfo?: WeekInfo }
    // Intl numbers the days 1 Monday … 7 Sunday.
    const firstDay = info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay
    return firstDay === undefined ? 1 : firstDay % 7
  } catch {
    return 1 // not a valid locale tag, so fall back to the ISO week
  }
}

/** Short weekday names for the grid's columns, starting at `weekStart`. */
export function weekdayLabels(weekStart: number): string[] {
  const format = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
  return Array.from({ length: 7 }, (_, index) => format.format(localDate(addDays(A_SUNDAY, weekStart + index))))
}

/** "September 2026" for any date in that month. */
export function monthLabel(date: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(localDate(monthStart(date)))
}

/** The four to six weeks that show the month of `date`, each starting on `weekStart`. */
export function monthWeeks(date: string, weekStart: number): string[][] {
  const first = monthStart(date)
  const nextMonth = addMonths(first, 1)
  const weeks: string[][] = []
  for (let start = addDays(first, -((weekdayOf(first) - weekStart + 7) % 7)); start < nextMonth; start = addDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, index) => addDays(start, index)))
  }
  return weeks
}

/** Events first, since they take the whole day; then meetings and tasks by time. */
function dayOrder(item: CalendarItem): string {
  if (item.kind === 'holiday') return '0'
  if (item.kind === 'event') return '0'
  if (item.kind === 'meeting') return item.meeting.time ? `2${item.meeting.time}` : '1'
  return `2${timeKey(taskWhen(item.task) ?? '')}`
}

/** Events, meeting days, and open dated tasks from `start` to `end`, by local date, in the order a day lists them. */
export function calendarItems(
  data: { events: CalendarEvent[]; meetings: Meeting[]; meetingNotes: MeetingNote[]; tasks: Task[] },
  start: string,
  end: string,
  region?: NzRegion | null,
): Map<string, CalendarItem[]> {
  const byDate = new Map<string, CalendarItem[]>()
  const add = (date: string, item: CalendarItem) => {
    if (date < start || date > end) return
    const items = byDate.get(date) ?? []
    items.push(item)
    byDate.set(date, items)
  }
  for (const event of data.events) {
    for (const date of eventDates(event, start, end)) add(date, { kind: 'event', id: event.id, event })
  }
  if (region !== undefined) {
    for (let year = Number(start.slice(0, 4)); year <= Number(end.slice(0, 4)); year++) {
      for (const holiday of nzHolidays(year, region)) add(holiday.date, { kind: 'holiday', id: `holiday:${holiday.date}:${holiday.name}`, holiday })
    }
  }
  const noteCount = noteCounter(data.meetingNotes)
  for (const meeting of data.meetings) {
    for (const date of meetingDates(meeting, start, end)) {
      add(date, { kind: 'meeting', id: `${meeting.id} ${date}`, meeting, date, noteCount: noteCount(meeting.id, date) })
    }
  }
  for (const task of data.tasks) {
    const when = isOpenTask(task) ? taskWhen(task) : null
    if (when) add(dateKey(when), { kind: 'task', id: task.id, task })
  }
  for (const items of byDate.values()) items.sort((a, b) => dayOrder(a).localeCompare(dayOrder(b)))
  return byDate
}

/** Events from today on, soonest first. */
export function upcomingEvents(events: CalendarEvent[], today: string): UpcomingEvent[] {
  return events
    .map((event) => {
      const date = eventDates(event, today, addMonths(today, 48))[0]
      return date ? { event: { ...event, date }, days: daysBetween(today, date) } : null
    })
    .filter((item): item is UpcomingEvent => item !== null)
    .sort((a, b) => a.days - b.days)
}

/** Leap-day birthdays keep 29 February and recur only in leap years. */
export function eventDates(event: CalendarEvent, start: string, end: string): string[] {
  if (event.repeat !== 'yearly') return event.date >= start && event.date <= end ? [event.date] : []
  const dates: string[] = []
  for (let year = Number(start.slice(0, 4)); year <= Number(end.slice(0, 4)); year++) {
    const date = `${year}${event.date.slice(4)}`
    if (date >= event.date && date >= start && date <= end && isDateKey(date)) dates.push(date)
  }
  return dates
}

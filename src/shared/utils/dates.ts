// Local calendar dates as YYYY-MM-DD keys, the form `<input type="date">` uses. Arithmetic on keys
// runs in UTC, where every day is 24 hours, so it never meets a daylight-saving change.

export const DAY_MS = 86_400_000
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

const pad = (number: number) => String(number).padStart(2, '0')

/** The local calendar date of an instant. */
export function dateKey(value: Date | string): string {
  const date = new Date(value)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** The local time of day of an instant, HH:mm. */
export function timeKey(value: string): string {
  const date = new Date(value)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function keyTime(key: string): number {
  const [year, month, day] = key.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function keyFromTime(time: number): string {
  const date = new Date(time)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export function isDateKey(value: unknown): value is string {
  const match = typeof value === 'string' ? DATE_PATTERN.exec(value) : null
  return !!match && Number(match[1]) >= 1000 && keyFromTime(keyTime(value as string)) === value
}

/** A 24-hour local time, HH:mm. */
export function isTimeKey(value: unknown): value is string {
  return typeof value === 'string' && TIME_PATTERN.test(value)
}

export function addDays(key: string, days: number): string {
  return keyFromTime(keyTime(key) + days * DAY_MS)
}

/** Whole days from `from` to `to`: 1 when `to` is the next day. */
export function daysBetween(from: string, to: string): number {
  return Math.round((keyTime(to) - keyTime(from)) / DAY_MS)
}

/** 0 for Sunday through 6 for Saturday. */
export function weekdayOf(key: string): number {
  return new Date(keyTime(key)).getUTCDay()
}

export function monthStart(key: string): string {
  return `${key.slice(0, 7)}-01`
}

export function addMonths(key: string, months: number): string {
  const date = new Date(keyTime(monthStart(key)))
  date.setUTCMonth(date.getUTCMonth() + months)
  return keyFromTime(date.getTime())
}

/** Whole local days from today to an instant: 0 today, 1 tomorrow, -1 yesterday. */
export function dayOffset(value: string, now: Date): number {
  return daysBetween(dateKey(now), dateKey(value))
}

/** A date key (and optional HH:mm time) as a local Date, for formatting. */
export function localDate(key: string, time: string | null = null): Date {
  const [year, month, day] = key.split('-').map(Number)
  const [hours, minutes] = (time ?? '00:00').split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes)
}

/** "Today", "Tomorrow", "In 3 days", "Yesterday", or "5 days ago". */
export function countdownLabel(days: number): string {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  return days > 1 ? `In ${days} days` : `${-days} days ago`
}

/** A compact day such as "Mon 28 Sep". */
export function shortDayLabel(key: string): string {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(localDate(key))
}

/** A full day such as "Monday 28 September", with the year when it is not `today`'s. */
export function longDayLabel(key: string, today: string): string {
  const sameYear = key.slice(0, 4) === today.slice(0, 4)
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) }).format(
    localDate(key),
  )
}

/** A local HH:mm time in the reader's clock style, such as "10:00 AM" or "10:00". */
export function timeOfDayLabel(time: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(localDate('2000-01-01', time))
}

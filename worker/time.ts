const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/

function wallClock(time: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(time))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
  return {
    weekday: part('weekday'),
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
    asUtc: Date.UTC(+part('year'), +part('month') - 1, +part('day'), +part('hour'), +part('minute'), +part('second')),
  }
}

function offsetAt(time: number, timeZone: string): number {
  return wallClock(time, timeZone).asUtc - Math.floor(time / 1000) * 1000
}

/** Converts a local wall time such as `2026-09-27T09:00` in `timeZone` to an ISO UTC timestamp. */
export function localToUtc(local: string, timeZone: string): string | null {
  const match = LOCAL_PATTERN.exec(local)
  if (!match) return null
  const [year, month, day, hour, minute] = match.slice(1, 6).map(Number)
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  const check = new Date(wall)
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59) return null
  // A second pass corrects the offset when the first guess lands across a DST change.
  const guess = wall - offsetAt(wall, timeZone)
  return new Date(wall - offsetAt(guess, timeZone)).toISOString()
}

/** Describes an instant as the author saw it, e.g. `Saturday 2026-09-26 23:14`. */
export function describeLocalTime(iso: string, timeZone: string): string {
  const clock = wallClock(Date.parse(iso), timeZone)
  return `${clock.weekday} ${clock.date} ${clock.time}`
}

/** The next `days` local dates with weekday names, so the model never has to count weekdays. */
export function upcomingDays(iso: string, timeZone: string, days = 14): string[] {
  const start = Date.parse(iso)
  return Array.from({ length: days }, (_, index) => {
    const clock = wallClock(start + (index + 1) * 86_400_000, timeZone)
    return `${clock.weekday} ${clock.date}`
  })
}

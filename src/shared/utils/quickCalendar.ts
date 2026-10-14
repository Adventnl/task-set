import { en } from 'chrono-node'
import { dateKey, isDateKey, localDate } from './dates'
import type { EventInput } from '../types/calendar'

/** Date phrases use today as reference, never the month being browsed. Words are kept intact. */
export function quickCalendarInput(text: string, fallback: string, today: string): EventInput {
  const parsed = en.GB.parse(text, localDate(today), { forwardDate: true })
  const dated = parsed.filter((result) => result.start.isCertain('day') || result.start.isCertain('weekday'))
  if (dated.length > 1 || dated.some((result) => result.end)) throw new Error('Please add one calendar date at a time.')
  const result = dated[0]
  let date = result ? dateKey(result.start.date()) : fallback
  // A weekday plus an ordinal without a month means the next matching date, not two events.
  const ordinal = /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/i.exec(text)
  if (ordinal && result && !result.start.isCertain('month')) {
    const weekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(ordinal[1].toLowerCase())
    const reference = localDate(today)
    for (let offset = 0; offset < 24; offset++) {
      const candidate = new Date(reference.getFullYear(), reference.getMonth() + offset, Number(ordinal[2]), 12)
      if (candidate.getDate() === Number(ordinal[2]) && candidate.getDay() === weekday && dateKey(candidate) >= today) { date = dateKey(candidate); break }
    }
  }
  if (!isDateKey(date)) throw new Error('That date is not valid. Choose a day on the calendar.')
  const birthday = /\bbirthday\b/i.test(text)
  return { date, text: text.trim(), repeat: birthday ? 'yearly' : null, category: birthday ? 'birthday' : null }
}

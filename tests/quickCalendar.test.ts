import { describe, expect, it } from 'vitest'
import { quickCalendarInput } from '../src/shared/utils/quickCalendar'
import { eventDates, upcomingEvents } from '../src/shared/utils/calendarView'
import type { CalendarEvent } from '../src/shared/types/calendar'

describe('quick calendar', () => {
  const parse = (text: string) => quickCalendarInput(text, '2028-05-01', '2026-10-14')
  it('uses the next occurrence of a named date, independently of the browsed month', () => {
    expect(parse('Dinner on December 22nd').date).toBe('2026-12-22')
    expect(parse('Dinner on January 5th').date).toBe('2027-01-05')
    expect(parse('Dentist tomorrow').date).toBe('2026-10-15')
  })
  it('honours an explicit year and NZ day-first numeric dates', () => {
    expect(parse('Dinner on December 22nd 2025').date).toBe('2025-12-22')
    expect(parse('Dentist on 22/12/2027').date).toBe('2027-12-22')
  })
  it('keeps an undated entry on the selected day and preserves time words', () => {
    expect(parse('Dinner at night')).toMatchObject({ date: '2028-05-01', text: 'Dinner at night' })
  })
  it('handles a weekday and day number without assuming the current month', () => {
    expect(parse('Dinner on Thursday the 29th').date).toBe('2026-10-29')
  })
  it('identifies birthdays and rejects ranges instead of silently discarding dates', () => {
    expect(parse('Alex birthday on December 22nd')).toMatchObject({ category: 'birthday', repeat: 'yearly' })
    expect(() => parse('Trip December 22nd to December 24th')).toThrow()
  })
})
describe('yearly calendar entries', () => {
  const event: CalendarEvent = { id: 'birthday', date: '2024-02-29', text: 'Birthday', repeat: 'yearly', category: 'birthday', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', deletedAt: null }
  it('does not move leap birthdays to a different day', () => {
    expect(eventDates(event, '2026-01-01', '2028-12-31')).toEqual(['2028-02-29'])
    expect(upcomingEvents([event], '2026-10-14')[0].event.date).toBe('2028-02-29')
  })
})

import { describe, expect, it } from 'vitest'
import { anniversaryRegion, nzHolidays } from '../src/shared/utils/nzHolidays'

describe('NZ calendar dates', () => {
  const date = (year: number, name: string) => nzHolidays(year, 'Auckland').find((holiday) => holiday.name === name)?.date
  it('matches the government’s 2026 and 2027 national dates', () => {
    expect(date(2026, 'Labour Day')).toBe('2026-10-26')
    expect(date(2026, 'Matariki')).toBe('2026-07-10')
    expect(date(2027, 'Matariki')).toBe('2027-06-25')
    expect(date(2027, 'Good Friday')).toBe('2027-03-26')
    expect(date(2027, 'Easter Monday')).toBe('2027-03-29')
  })
  it('keeps actual and observed paired holidays on the correct weekdays', () => {
    expect(date(2027, 'Christmas Day (observed)')).toBe('2027-12-27')
    expect(date(2027, 'Boxing Day (observed)')).toBe('2027-12-28')
    expect(date(2028, 'New Year’s Day (observed)')).toBe('2028-01-03')
    expect(date(2028, 'Day after New Year’s Day (observed)')).toBe('2028-01-04')
    expect(date(2026, 'Auckland Anniversary')).toBe('2026-01-26')
    expect(date(2027, 'Auckland Anniversary')).toBe('2027-02-01')
  })
  it('labels Christmas Eve and Guy Fawkes as observances', () => {
    expect(nzHolidays(2026, null).find((holiday) => holiday.name === 'Guy Fawkes Day')).toMatchObject({ date: '2026-11-05', public: false })
    expect(nzHolidays(2026, null).find((holiday) => holiday.name === 'Christmas Eve')?.public).toBe(false)
  })
  it('maps anniversary areas and local exceptions', () => {
    expect(anniversaryRegion('Waikato', 'Hamilton')).toBe('Auckland')
    expect(anniversaryRegion('Canterbury', 'Timaru District')).toBe('South Canterbury')
    expect(anniversaryRegion('West Coast', 'Buller District')).toBe('Nelson')
  })
})

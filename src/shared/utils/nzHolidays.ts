import { addDays, dateKey, weekdayOf } from './dates'

export interface Holiday { date: string; name: string; public: boolean }
export const NZ_REGIONS = ['Auckland', 'Wellington', 'Canterbury', 'South Canterbury', 'Hawke’s Bay', 'Marlborough', 'Nelson', 'Otago', 'Southland', 'Taranaki', 'Westland', 'Chatham Islands'] as const
export type NzRegion = typeof NZ_REGIONS[number]
// Government's published Matariki schedule, 2022–2052; dates outside it are deliberately omitted.
const MATARIKI = ['06-24', '07-14', '06-28', '06-20', '07-10', '06-25', '07-14', '07-06', '06-21', '07-11', '07-02', '06-24', '07-07', '06-29', '07-18', '07-10', '06-25', '07-15', '07-06', '07-19', '07-11', '07-03', '06-24', '07-07', '06-29', '07-19', '07-03', '06-25', '07-15', '06-30', '06-21']

function easter(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const n = h + l - 7 * m + 114
  return dateKey(new Date(year, Math.floor(n / 31) - 1, n % 31 + 1, 12))
}
function nthWeekday(year: number, month: number, day: number, n: number): string {
  const first = `${year}-${String(month).padStart(2, '0')}-01`
  return addDays(first, (day - weekdayOf(first) + 7) % 7 + (n - 1) * 7)
}
function nearestMonday(date: string): string { return addDays(date, ((1 - weekdayOf(date) + 10) % 7) - 3) }

/** Actual dates plus clearly labelled observed weekdays; celebrations are never called public holidays. */
export function nzHolidays(year: number, region: NzRegion | null): Holiday[] {
  const list: Holiday[] = []
  const add = (date: string, name: string, publicHoliday = true) => list.push({ date, name, public: publicHoliday })
  const fixed = (monthDay: string, name: string, paired = false) => {
    const date = `${year}-${monthDay}`
    add(date, name)
    const weekday = weekdayOf(date)
    if (weekday === 0 || weekday === 6) add(addDays(date, paired ? 2 : weekday === 6 ? 2 : 1), `${name} (observed)`)
  }
  fixed('01-01', 'New Year’s Day', true)
  fixed('01-02', 'Day after New Year’s Day', true)
  fixed('02-06', 'Waitangi Day')
  const sunday = easter(year)
  add(addDays(sunday, -2), 'Good Friday')
  add(sunday, 'Easter Sunday', false)
  add(addDays(sunday, 1), 'Easter Monday')
  fixed('04-25', 'Anzac Day')
  add(nthWeekday(year, 6, 1, 1), year >= 2023 ? 'King’s Birthday' : 'Queen’s Birthday')
  if (MATARIKI[year - 2022]) add(`${year}-${MATARIKI[year - 2022]}`, 'Matariki')
  const labour = nthWeekday(year, 10, 1, 4)
  add(labour, 'Labour Day')
  fixed('12-25', 'Christmas Day', true)
  fixed('12-26', 'Boxing Day', true)
  add(`${year}-11-05`, 'Guy Fawkes Day', false)
  add(`${year}-12-24`, 'Christmas Eve', false)
  add(`${year}-12-31`, 'New Year’s Eve', false)
  const anniversary: Record<NzRegion, string> = {
    Auckland: nearestMonday(`${year}-01-29`), Wellington: nearestMonday(`${year}-01-22`),
    Canterbury: addDays(nthWeekday(year, 11, 2, 2), 3), 'South Canterbury': nthWeekday(year, 9, 1, 4),
    'Hawke’s Bay': addDays(labour, -3), Marlborough: addDays(labour, 7), Nelson: nearestMonday(`${year}-02-01`),
    Otago: nearestMonday(`${year}-03-23`), Southland: addDays(sunday, 2), Taranaki: nthWeekday(year, 3, 1, 2),
    Westland: nearestMonday(`${year}-12-01`), 'Chatham Islands': nearestMonday(`${year}-11-30`),
  }
  if (region) add(anniversary[region] === addDays(sunday, 1) ? addDays(anniversary[region], 7) : anniversary[region], `${region} Anniversary`)
  return list.sort((a, b) => a.date.localeCompare(b.date))
}

/** Administrative regions do not always match anniversary areas. Keep the selection editable. */
export function anniversaryRegion(state: string, district: string): NzRegion | null {
  if (/buller/i.test(district)) return 'Nelson'
  if (/timaru|mackenzie|waimate/i.test(district)) return 'South Canterbury'
  if (/auckland|northland|waikato|bay of plenty|gisborne/i.test(state)) return 'Auckland'
  if (/manawat|whanganui|wellington/i.test(state)) return 'Wellington'
  if (/tasman|nelson/i.test(state)) return 'Nelson'
  if (/west coast/i.test(state)) return 'Westland'
  return NZ_REGIONS.find((region) => state.toLocaleLowerCase().replace('’', "'").includes(region.toLocaleLowerCase().replace('’', "'"))) ?? null
}

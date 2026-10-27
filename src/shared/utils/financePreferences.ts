import type { FinanceFilter } from '../types/finance'
import { financePeriod, type FinancePeriod } from './financeDashboard'

export const EMPTY_FINANCE_FILTER: FinanceFilter = {
  search: '',
  account: '',
  category: '',
  review: '',
  direction: '',
  start: '',
  end: '',
  min: '',
  max: '',
  tag: '',
  page: 0,
  oldest: false,
}
const PERIODS: FinancePeriod[] = [
  'month',
  '7',
  '30',
  '60',
  '90',
  '180',
  '365',
  'year',
  'all',
]
export interface FinancePreferences {
  filter: FinanceFilter
  period: FinancePeriod | 'custom'
}
export function financePreferences(value: unknown): FinancePreferences {
  const defaults = { ...EMPTY_FINANCE_FILTER, ...financePeriod('60') }
  if (!value || typeof value !== 'object')
    return { filter: defaults, period: '60' }
  const raw = value as Partial<FinancePreferences>
  const filter = { ...defaults }
  if (raw.filter && typeof raw.filter === 'object') {
    for (const key of Object.keys(
      EMPTY_FINANCE_FILTER,
    ) as (keyof FinanceFilter)[]) {
      if (
        key !== 'page' &&
        key !== 'oldest' &&
        typeof raw.filter[key] === 'string'
      )
        Object.assign(filter, {
          [key]: (raw.filter[key] as string).slice(0, 200),
        })
    }
    filter.oldest = raw.filter.oldest === true
  }
  const period = PERIODS.includes(raw.period as FinancePeriod)
    ? (raw.period as FinancePeriod)
    : 'custom'
  if (period !== 'custom') Object.assign(filter, financePeriod(period))
  if (
    [filter.start, filter.end].some(
      (date) => date && !/^\d{4}-\d{2}-\d{2}$/.test(date),
    )
  )
    Object.assign(filter, financePeriod('60'))
  return { filter, period }
}
export function selectedFinancePeriod(
  filter: FinanceFilter,
): FinancePreferences['period'] {
  return (
    PERIODS.find((period) => {
      const range = financePeriod(period)
      return range.start === filter.start && range.end === filter.end
    }) ?? 'custom'
  )
}
export function paginationPages(page: number, total: number): number[] {
  const last = Math.max(0, Math.ceil(total / 50) - 1)
  return [
    ...new Set([0, last, ...Array.from({ length: 5 }, (_, i) => page + i - 2)]),
  ]
    .filter((value) => value >= 0 && value <= last)
    .sort((a, b) => a - b)
}

import type {
  FinanceAccount,
  FinanceFilter,
  FinanceMetrics,
} from '../types/finance'
import { nzDay } from './finance'

export type FinancePeriod =
  'month' | '7' | '30' | '90' | '180' | '365' | 'year' | 'all'

export function financePeriod(
  period: FinancePeriod,
  now = new Date(),
): Pick<FinanceFilter, 'start' | 'end'> {
  const end = nzDay(now)
  if (period === 'all') return { start: '', end: '' }
  if (period === 'month') return { start: end.slice(0, 7) + '-01', end }
  if (period === 'year') return { start: end.slice(0, 4) + '-01-01', end }
  const start = new Date(end + 'T00:00:00Z')
  start.setUTCDate(start.getUTCDate() - (Number(period) - 1))
  return { start: start.toISOString().slice(0, 10), end }
}

export function accountTotals(accounts: FinanceAccount[]) {
  const included = accounts.filter(
    (a) => a.included && !a.archived && a.currency === 'NZD',
  )
  const sum = (field: 'current' | 'available') =>
    included.length && included.every((a) => a[field] !== null)
      ? included.reduce((total, a) => total + (a[field] ?? 0), 0)
      : null
  return {
    current: sum('current'),
    available: sum('available'),
    count: included.length,
  }
}

/** Plot recorded daily totals at their actual dates; never imply complete bank coverage. */
export function spendingPlot(daily: FinanceMetrics['daily']) {
  const sorted = [...daily].sort((a, b) => a.id.localeCompare(b.id))
  const first = Date.parse(sorted[0]?.id ?? ''),
    last = Date.parse(sorted.at(-1)?.id ?? '')
  const max = Math.max(1, ...sorted.map((d) => d.amount))
  const min = Math.min(0, ...sorted.map((d) => d.amount))
  const y = (amount: number) => 180 - ((amount - min) / (max - min)) * 152
  const points = sorted.map((d) => ({
    ...d,
    x:
      sorted.length === 1
        ? 320
        : 24 + ((Date.parse(d.id) - first) / Math.max(1, last - first)) * 592,
    y: y(d.amount),
  }))
  return { points, max, zeroY: y(0) }
}

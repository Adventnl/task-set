import { describe, expect, it } from 'vitest'
import type { FinanceAccount } from '../src/shared/types/finance'
import {
  accountTotals,
  financePeriod,
  spendingPlot,
} from '../src/shared/utils/financeDashboard'

describe('finance dashboard', () => {
  it('uses Auckland calendar dates across UTC midnight and daylight-saving boundaries', () => {
    expect(financePeriod('month', new Date('2026-09-30T11:30:00Z'))).toEqual({
      start: '2026-10-01',
      end: '2026-10-01',
    })
    expect(financePeriod('30', new Date('2026-10-01T00:00:00Z'))).toEqual({
      start: '2026-09-02',
      end: '2026-10-01',
    })
    expect(financePeriod('all')).toEqual({ start: '', end: '' })
    expect(financePeriod('year', new Date('2026-12-31T12:00:00Z'))).toEqual({
      start: '2027-01-01',
      end: '2027-01-01',
    })
  })
  it('totals only included NZD accounts and keeps unavailable balances unknown', () => {
    const account = {
      included: true,
      archived: false,
      currency: 'NZD',
      current: 12000,
      available: 10000,
    } as FinanceAccount
    expect(
      accountTotals([
        account,
        { ...account, currency: 'USD' },
        { ...account, archived: true },
        { ...account, included: false },
      ]),
    ).toEqual({ current: 12000, available: 10000, count: 1 })
    expect(accountTotals([account, { ...account, current: null }])).toEqual({
      current: null,
      available: 20000,
      count: 2,
    })
    expect(accountTotals([])).toEqual({
      current: null,
      available: null,
      count: 0,
    })
  })
  it('spaces observations by date, sorts without mutation, and keeps refunds inside the plot', () => {
    const daily = [
      { id: '2026-10-11', amount: -500 },
      { id: '2026-10-01', amount: 1000 },
      { id: '2026-10-02', amount: 0 },
    ]
    const plot = spendingPlot(daily)
    expect(plot.points.map((p) => p.x)).toEqual([24, 83.2, 616])
    expect(
      plot.points.every((p) => Number.isFinite(p.y) && p.y >= 28 && p.y <= 180),
    ).toBe(true)
    expect(daily[0].id).toBe('2026-10-11')
    expect(spendingPlot([{ id: '2026-10-01', amount: 0 }]).points[0].x).toBe(
      320,
    )
    expect(spendingPlot([]).points).toEqual([])
  })
})

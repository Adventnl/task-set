// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import {
  financePreferences,
  paginationPages,
} from '../src/shared/utils/financePreferences'
import { financePeriod } from '../src/shared/utils/financeDashboard'
import { financeService } from '../src/services/financeService'
afterEach(() => localStorage.clear())
it('defaults to sixty Auckland calendar days and persists every transaction filter without retaining page offsets', () => {
  expect(financeService.preferences().filter).toMatchObject(financePeriod('60'))
  const filter = {
    ...financeService.preferences().filter,
    search: 'market',
    category: 'user-food',
    account: 'account',
    review: 'needs-review',
    page: 6,
    oldest: true,
  }
  financeService.savePreferences(filter)
  expect(financeService.preferences().filter).toEqual({ ...filter, page: 0 })
})
it('rolls preset dates forward when reopened and retains explicit custom dates', () => {
  expect(
    financePreferences({
      period: '60',
      filter: { start: '2020-01-01', end: '2020-03-01' },
    }).filter,
  ).toMatchObject(financePeriod('60'))
  expect(
    financePreferences({
      period: 'custom',
      filter: { start: '2020-01-01', end: '2020-03-01' },
    }).filter,
  ).toMatchObject({ start: '2020-01-01', end: '2020-03-01' })
  expect(
    financePreferences({ period: 'all', filter: {} }).filter,
  ).toMatchObject({ start: '', end: '' })
})
it('recovers safely from invalid browser storage', () => {
  localStorage.setItem('taskset.finance.preferences.v1', '{bad json')
  expect(financeService.preferences().period).toBe('60')
  expect(
    financePreferences({
      filter: { start: 'not a date', page: -100, oldest: 'true' },
    }).filter,
  ).toMatchObject({ ...financePeriod('60'), page: 0, oldest: false })
})
it('keeps first, last and adjacent numbered pages reachable without listing hundreds of buttons', () => {
  expect(paginationPages(5, 1000)).toEqual([0, 3, 4, 5, 6, 7, 19])
  expect(paginationPages(0, 0)).toEqual([0])
  expect(paginationPages(1, 101)).toEqual([0, 1, 2])
})

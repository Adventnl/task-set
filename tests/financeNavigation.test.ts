// @vitest-environment jsdom
import {
  EMPTY_FINANCE_FILTER,
  financePreferences,
} from '../src/shared/utils/financePreferences'
import { act, createElement, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useFinance } from '../src/shared/hooks/useFinance'
import { financeService } from '../src/services/financeService'
import type {
  FinanceData,
  FinanceDetail,
  FinanceEdit,
  FinanceMetrics,
  FinanceTransaction,
} from '../src/shared/types/finance'
vi.mock('../src/services/financeService', () => ({
  financeService: {
    load: vi.fn(),
    list: vi.fn(),
    metrics: vi.fn(),
    recurring: vi.fn(),
    transaction: vi.fn(),
    command: vi.fn(),
    save: vi.fn(),
    preferences: vi.fn(),
    savePreferences: vi.fn(),
    reports: vi.fn(),
    preview: vi.fn(),
    createWorkbook: vi.fn(),
  },
}))
let root: Root,
  container: HTMLDivElement,
  finance: ReturnType<typeof useFinance>
const metadata = {
  configured: false,
  initialized: false,
  unreadCount: 0,
  accounts: [],
  categories: [],
  rules: [],
  budgets: [],
  notifications: [],
  balances: [],
  syncs: [],
  transactionCount: 0,
  earliest: null,
  lastSync: null,
  refreshRequestedAt: null,
  settings: {
    notifications: true,
    push: false,
    privateNotifications: true,
    currency: 'NZD',
    timezone: 'Pacific/Auckland',
  },
  vapidPublicKey: null,
} satisfies FinanceData
function Probe({ active = true }: { active?: boolean }) {
  finance = useFinance(active, true)
  return null
}
async function render() {
  await act(async () => {
    root.render(createElement(StrictMode, null, createElement(Probe)))
  })
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  history.replaceState(null, '', '/')
  vi.mocked(financeService.preferences).mockReturnValue(
    financePreferences(null),
  )
  vi.mocked(financeService.reports).mockResolvedValue([])
  vi.mocked(financeService.save).mockResolvedValue(undefined)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  vi.mocked(financeService.load).mockResolvedValue(metadata)
  vi.mocked(financeService.list).mockResolvedValue({
    items: [],
    income: 0,
    expenses: 0,
    total: 0,
  })
  vi.mocked(financeService.metrics).mockResolvedValue({} as FinanceMetrics)
  vi.mocked(financeService.recurring).mockResolvedValue([])
  vi.mocked(financeService.command).mockResolvedValue(undefined)
  vi.mocked(financeService.transaction).mockImplementation(
    async (id) =>
      ({ transaction: { id }, audit: [], attachments: [] }) as FinanceDetail,
  )
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})
it('marks a notification transaction read even before metadata has hydrated', async () => {
  let resolveMetadata!: (data: FinanceData) => void
  vi.mocked(financeService.load).mockReturnValue(
    new Promise((resolve) => {
      resolveMetadata = resolve
    }),
  )
  history.replaceState(null, '', '/#finance/direct-transaction')
  await render()
  expect(financeService.command).toHaveBeenCalledWith('notifications/read', {
    transactionId: 'direct-transaction',
  })
  expect(finance.transaction?.id).toBe('direct-transaction')
  expect(location.hash).toBe('#finance')
  await act(async () => resolveMetadata(metadata))
})
it('opens a new notification deep link while the finance section is already active', async () => {
  await render()
  await act(async () => {
    history.replaceState(null, '', '/#finance/another-transaction')
    window.dispatchEvent(new Event('hashchange'))
  })
  expect(finance.transaction?.id).toBe('another-transaction')
  expect(financeService.command).toHaveBeenCalledWith('notifications/read', {
    transactionId: 'another-transaction',
  })
})

it('imports configured bank history once on first entry, including StrictMode', async () => {
  vi.mocked(financeService.load).mockResolvedValue({
    ...metadata,
    configured: true,
  })
  await render()
  expect(financeService.command).toHaveBeenCalledTimes(1)
  expect(financeService.command).toHaveBeenCalledWith('sync')
  await render()
  expect(financeService.command).toHaveBeenCalledTimes(1)
})

it('keeps an initial import error visible, reloads partial metadata, and allows explicit retry', async () => {
  vi.mocked(financeService.load).mockResolvedValue({
    ...metadata,
    configured: true,
  })
  vi.mocked(financeService.command).mockRejectedValueOnce(
    new Error('Akahu denied access'),
  )
  await render()
  expect(finance.error).toBe('Akahu denied access')
  expect(finance.busy).toBe(false)
  expect(financeService.command).toHaveBeenCalledTimes(1)
  expect(vi.mocked(financeService.load).mock.calls.length).toBeGreaterThan(2)
  await act(async () => {
    await finance.sync()
  })
  expect(financeService.command).toHaveBeenCalledTimes(2)
  expect(finance.error).toBe('')
})

it('does not sync unconfigured accounts, and refreshes imported history when stale', async () => {
  await render()
  expect(financeService.command).not.toHaveBeenCalled()
  vi.mocked(financeService.load).mockResolvedValue({
    ...metadata,
    configured: true,
    initialized: true,
  })
  await act(async () => {
    root.render(createElement(Probe, { active: false }))
  })
  await act(async () => {
    root.render(createElement(Probe, { active: true }))
  })
  expect(financeService.command).toHaveBeenCalledWith('sync')
})

it('clears review/category restrictions for the overview and preserves transaction filters for reports', async () => {
  await render()
  await act(async () => {
    finance.choose('Review Inbox')
  })
  expect(financeService.list).toHaveBeenLastCalledWith(
    { ...EMPTY_FINANCE_FILTER, review: 'needs-review' },
    expect.any(AbortSignal),
  )
  await act(async () => {
    finance.setFilter({ review: 'all' })
  })
  expect(financeService.list).toHaveBeenLastCalledWith(
    EMPTY_FINANCE_FILTER,
    expect.any(AbortSignal),
  )
  await act(async () => {
    finance.choose('Transactions')
    finance.setFilter({
      category: 'groceries',
      search: 'market',
      start: '2026-10-01',
      end: '2026-10-27',
    })
  })
  await act(async () => {
    finance.choose('Reports')
  })
  expect(finance.filter.category).toBe('groceries')
  await act(async () => {
    finance.choose('Overview')
  })
  expect(finance.filter).toEqual({
    ...EMPTY_FINANCE_FILTER,
    start: '2026-10-01',
    end: '2026-10-27',
  })
})

it('coalesces repeated sync clicks before React rerenders', async () => {
  await render()
  await act(async () => {
    await Promise.all([finance.sync(), finance.sync()])
  })
  expect(financeService.command).toHaveBeenCalledTimes(1)
})

it('checks cached bank data every five minutes while visible and coalesces focus-triggered checks', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-27T00:00:00Z'))
  vi.mocked(financeService.load).mockResolvedValue({
    ...metadata,
    configured: true,
    initialized: true,
    lastSync: new Date().toISOString(),
  })
  try {
    await render()
    expect(financeService.command).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000)
    })
    expect(financeService.command).toHaveBeenCalledExactlyOnceWith('sync')
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      window.dispatchEvent(new Event('focus'))
    })
    expect(financeService.command).toHaveBeenCalledTimes(1)
  } finally {
    vi.useRealTimers()
  }
})

const edit: FinanceEdit = {
  category: 'user-food',
  notes: 'My note',
  tags: [],
  review: 'reviewed',
  excluded: false,
  transferId: null,
  refundId: null,
  splits: [],
  createRule: true,
}
it('saves to the server and advances using the updated unreviewed queue, including later list pages', async () => {
  await render()
  await act(async () => finance.open('first'))
  vi.mocked(financeService.list).mockResolvedValue({
    items: [{ id: 'remaining' } as FinanceTransaction],
    total: 1,
    income: 0,
    expenses: 100,
  })
  await act(async () => {
    await finance.save(edit, true)
  })
  expect(financeService.save).toHaveBeenCalledWith('first', edit)
  expect(financeService.list).toHaveBeenCalledWith(
    expect.objectContaining({ review: 'needs-review', page: 0 }),
  )
  expect(finance.transaction?.id).toBe('remaining')
  expect(financeService.command).toHaveBeenCalledWith('notifications/read', {
    transactionId: 'remaining',
  })
  vi.mocked(financeService.list).mockResolvedValue({
    items: [],
    total: 0,
    income: 0,
    expenses: 0,
  })
  await act(async () => {
    await finance.save(edit, true)
  })
  expect(finance.transaction).toBeNull()
})
it('retains the transaction on failed save and never reopens the dialog after closing during save', async () => {
  await render()
  await act(async () => finance.open('first'))
  vi.mocked(financeService.save).mockRejectedValueOnce(new Error('Offline'))
  await act(async () => {
    await finance.save(edit, true)
  })
  expect(finance.transaction?.id).toBe('first')
  expect(finance.error).toBe('Offline')
  let finish!: () => void
  vi.mocked(financeService.save).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  let saving!: Promise<boolean>
  await act(async () => {
    saving = finance.save(edit, true)
    finance.close()
  })
  await act(async () => {
    finish()
    await saving
  })
  expect(finance.transaction).toBeNull()
})
it('preserves the saved dashboard period when leaving the all-history review inbox', async () => {
  await render()
  const range = { start: finance.filter.start, end: finance.filter.end }
  await act(async () => finance.choose('Review Inbox'))
  expect(finance.filter.start).toBe('')
  await act(async () => finance.choose('Overview'))
  expect(finance.filter).toMatchObject(range)
  expect(financeService.savePreferences).toHaveBeenLastCalledWith(
    expect.objectContaining(range),
  )
})

it('does not reopen a transaction after navigating away while its request is pending', async () => {
  await render()
  let resolveDetail!: (detail: FinanceDetail) => void
  vi.mocked(financeService.transaction).mockReturnValue(
    new Promise((resolve) => {
      resolveDetail = resolve
    }),
  )
  await act(async () => {
    finance.open('pending-detail')
    finance.open('pending-detail')
  })
  expect(financeService.transaction).toHaveBeenCalledTimes(1)
  await act(async () => {
    finance.choose('Accounts')
  })
  await act(async () => {
    resolveDetail({
      transaction: { id: 'pending-detail' },
      audit: [],
      attachments: [],
    } as FinanceDetail)
  })
  expect(finance.transaction).toBeNull()
  expect(finance.tab).toBe('Accounts')
})

it('opens a category across all history without retaining unrelated filters', async () => {
  await render()
  await act(async () =>
    finance.setFilter({
      search: 'old query',
      account: 'other',
      review: 'reviewed',
      start: '2026-10-01',
      end: '2026-10-02',
      tag: 'work',
      direction: 'credit',
    }),
  )
  await act(async () => finance.choose('Categories'))
  await act(async () => finance.drillCategory('food'))
  expect(finance.tab).toBe('Transactions')
  expect(finance.filter).toEqual({ ...EMPTY_FINANCE_FILTER, category: 'food' })
  expect(financeService.list).toHaveBeenLastCalledWith(
    { ...EMPTY_FINANCE_FILTER, category: 'food' },
    expect.any(AbortSignal),
  )
})
it('does not refetch totals, recurring payments or report history when changing transaction pages', async () => {
  await render()
  vi.mocked(financeService.list).mockResolvedValue({
    items: [{ id: 'row' } as FinanceTransaction],
    total: 328,
    income: 0,
    expenses: 0,
  })
  const totalsCalls = vi.mocked(financeService.metrics).mock.calls.length
  await act(async () => finance.setFilter({ page: 3 }))
  expect(financeService.metrics).toHaveBeenCalledTimes(totalsCalls)
  expect(financeService.recurring).not.toHaveBeenCalled()
  expect(financeService.reports).not.toHaveBeenCalled()
  expect(financeService.list).toHaveBeenLastCalledWith(
    expect.objectContaining({ page: 3 }),
    expect.any(AbortSignal),
  )
})
it('keeps a failed category deletion available to retry and clears removed category filters after success', async () => {
  await render()
  await act(async () => finance.setFilter({ category: 'old' }))
  vi.mocked(financeService.command).mockRejectedValueOnce(new Error('Offline'))
  await act(async () => {
    expect(await finance.deleteCategory('old', 'new')).toBe(false)
  })
  expect(finance.filter.category).toBe('old')
  expect(finance.error).toBe('Offline')
  await act(async () => {
    expect(await finance.deleteCategory('old', 'new')).toBe(true)
  })
  expect(finance.filter.category).toBe('new')
  expect(financeService.command).toHaveBeenLastCalledWith('categories/delete', {
    id: 'old',
    replacement: 'new',
  })
})
it('opens newly generated workbooks in the browser and never reopens a late workbook after leaving Reports', async () => {
  await render()
  await act(async () => finance.choose('Reports'))
  vi.mocked(financeService.createWorkbook).mockResolvedValue('saved-report')
  vi.mocked(financeService.preview).mockResolvedValue({ sheets: [] })
  await act(async () => {
    await finance.createWorkbook('Transaction Register')
  })
  expect(finance.workbook).toMatchObject({ id: 'saved-report', sheetIndex: 0 })
  let finish!: (preview: { sheets: [] }) => void
  vi.mocked(financeService.preview).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  let preview!: Promise<boolean>
  await act(async () => {
    preview = finance.previewWorkbook('saved-report', 1, 6)
  })
  await act(async () => finance.choose('Categories'))
  await act(async () => {
    finish({ sheets: [] })
    await preview
  })
  expect(finance.workbook).toBeNull()
  expect(finance.tab).toBe('Categories')
})

it('exports the current review queue without replacing saved transaction preferences', async () => {
  await render()
  const saved = { ...finance.filter }
  await act(async () => finance.choose('Review Inbox'))
  await act(async () => finance.setFilter({ category: 'uncategorized' }))
  await act(async () => finance.choose('Reports'))
  expect(finance.filter).toMatchObject({
    start: '',
    end: '',
    category: 'uncategorized',
    review: 'needs-review',
  })
  await act(async () => finance.choose('Transactions'))
  expect(finance.filter).toEqual(saved)
})

// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  EMPTY_FINANCE_FILTER,
  useFinance,
} from '../src/shared/hooks/useFinance'
import { financeService } from '../src/services/financeService'
import type {
  FinanceData,
  FinanceDetail,
  FinanceMetrics,
} from '../src/shared/types/finance'
vi.mock('../src/services/financeService', () => ({
  financeService: {
    load: vi.fn(),
    list: vi.fn(),
    metrics: vi.fn(),
    recurring: vi.fn(),
    transaction: vi.fn(),
    command: vi.fn(),
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

it('does not sync unconfigured or already imported accounts automatically', async () => {
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
  expect(financeService.command).not.toHaveBeenCalled()
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

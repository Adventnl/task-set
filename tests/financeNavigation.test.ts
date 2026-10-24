// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useFinance } from '../src/shared/hooks/useFinance'
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

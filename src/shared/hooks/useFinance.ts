import { useCallback, useEffect, useRef, useState } from 'react'
import { financeService } from '../../services/financeService'
import type {
  FinanceData,
  FinanceDetail,
  FinanceEdit,
  FinanceFilter,
  FinanceMetrics,
  FinancePage,
  FinanceTab,
  RecurringPayment,
  FinanceTransaction,
} from '../types/finance'
import { financePeriod } from '../utils/financeDashboard'
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
export function useFinance(active: boolean, signedIn: boolean) {
  const [data, setData] = useState<FinanceData | null>(null),
    [page, setPage] = useState<FinancePage>({
      items: [],
      total: 0,
      income: 0,
      expenses: 0,
    })
  const [detail, setDetail] = useState<FinanceDetail | null>(null),
    [recurring, setRecurring] = useState<RecurringPayment[]>([])
  const [metrics, setMetrics] = useState<FinanceMetrics | null>(null)
  const [tab, setTab] = useState<FinanceTab>('Overview'),
    [filter, setFilter] = useState<FinanceFilter>({
      ...EMPTY_FINANCE_FILTER,
      ...financePeriod('month'),
    })
  const [transaction, setTransaction] = useState<FinanceTransaction | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('')
  const revision = useRef(0),
    mounted = useRef(true),
    running = useRef(false),
    initialSyncAttempted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const load = useCallback(async (signal?: AbortSignal) => {
    const next = await financeService.load(signal)
    if (!signal?.aborted && mounted.current) setData(next)
  }, [])
  useEffect(() => {
    if (!signedIn) {
      initialSyncAttempted.current = false
      setData(null)
      setDetail(null)
      setRecurring([])
      setMetrics(null)
      setTransaction(null)
      setPage({ items: [], total: 0, income: 0, expenses: 0 })
      return
    }
    const controller = new AbortController()
    const refresh = () =>
      void load(controller.signal).catch((e: unknown) => {
        if (!controller.signal.aborted && active)
          setError(e instanceof Error ? e.message : 'Finance unavailable')
      })
    refresh()
    const timer = window.setInterval(refresh, 60000)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [signedIn, active, load])
  const effective = {
    ...filter,
    review:
      filter.review === 'all'
        ? ''
        : tab === 'Review Inbox'
          ? filter.review || 'needs-review'
          : filter.review,
  }
  const filterKey = JSON.stringify(effective)
  useEffect(() => {
    if (!active || !signedIn) return
    const controller = new AbortController()
    setLoading(true)
    void Promise.all([
      financeService.list(
        JSON.parse(filterKey) as FinanceFilter,
        controller.signal,
      ),
      financeService.metrics(
        JSON.parse(filterKey) as FinanceFilter,
        controller.signal,
      ),
      financeService.recurring(controller.signal),
    ])
      .then(([next, stats, recurring]) => {
        if (!controller.signal.aborted) {
          setPage(next)
          setMetrics(stats)
          setRecurring(recurring)
        }
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'Cannot load transactions')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [filterKey, active, signedIn, data])
  async function run(operation: () => Promise<void>, success = '') {
    if (running.current) return
    running.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await operation()
      if (mounted.current) {
        await load()
        setMessage(success)
      }
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : 'Finance operation failed')
        // Keep partial imports and the latest sync log visible after a failed operation.
        try {
          await load()
        } catch {
          /* Preserve the original operation error. */
        }
      }
    } finally {
      running.current = false
      if (mounted.current) setBusy(false)
    }
  }
  useEffect(() => {
    if (
      !active ||
      !signedIn ||
      !data?.configured ||
      data.initialized ||
      initialSyncAttempted.current ||
      running.current
    )
      return
    initialSyncAttempted.current = true
    void run(
      () => financeService.command('sync'),
      'Your bank accounts and available history have been imported.',
    )
  }, [active, signedIn, data])
  function open(id: string) {
    if (running.current) return
    const request = ++revision.current
    void run(async () => {
      const result = await financeService.transaction(id)
      if (request === revision.current && mounted.current) {
        setTransaction(result.transaction)
        setDetail(result)
      }
      await financeService.command('notifications/read', { transactionId: id })
    })
  }
  useEffect(() => {
    const handleLink = () => {
      if (!active || !signedIn || busy) return
      const id = window.location.hash.startsWith('#finance/')
        ? decodeURIComponent(window.location.hash.slice(9))
        : null
      if (id) {
        setTab('Review Inbox')
        open(id)
        history.replaceState(null, '', '#finance')
      }
    }
    handleLink()
    window.addEventListener('hashchange', handleLink)
    return () => window.removeEventListener('hashchange', handleLink)
  }, [active, signedIn, busy])
  function choose(next: FinanceTab) {
    revision.current++
    setMessage('')
    setTab(next)
    setFilter((f) =>
      next === 'Review Inbox'
        ? { ...EMPTY_FINANCE_FILTER }
        : next === 'Overview' ||
            next === 'Analytics' ||
            (tab === 'Review Inbox' && next === 'Transactions')
          ? { ...EMPTY_FINANCE_FILTER, start: f.start, end: f.end }
          : { ...f, page: 0 },
    )
    setTransaction(null)
  }
  return {
    data,
    page,
    detail,
    recurring,
    metrics,
    tab,
    filter,
    transaction,
    busy,
    loading,
    error,
    message,
    choose,
    open,
    close: () => {
      revision.current++
      setTransaction(null)
    },
    setFilter: (patch: Partial<FinanceFilter>) =>
      setFilter((f) => ({ ...f, ...patch, page: patch.page ?? 0 })),
    sync: () =>
      run(
        () => financeService.command('sync'),
        'Synchronisation completed. Bank data may still be cached.',
      ),
    refresh: () =>
      run(
        () => financeService.command('refresh'),
        'Refresh requested. Waiting for updated bank timestamps; use Check available data after Akahu has processed it.',
      ),
    command: (path: string, value: unknown) =>
      run(() => financeService.command(path, value), 'Saved'),
    save: (input: FinanceEdit, next: boolean) =>
      run(async () => {
        if (!transaction) return
        await financeService.save(transaction.id, input)
        const nextId = next
          ? page.items.find((t) => t.id !== transaction.id)?.id
          : null
        const nextDetail = nextId
          ? await financeService.transaction(nextId)
          : null
        setTransaction(nextDetail?.transaction ?? null)
        setDetail(nextDetail)
      }, 'Review saved'),
    push: () =>
      run(async () => {
        if (!data?.vapidPublicKey)
          throw new Error('Configure the server VAPID keys first')
        await financeService.enablePush(data.vapidPublicKey)
        await financeService.command('settings', {
          ...data.settings,
          push: true,
        })
      }, 'Push enabled on this device'),
    restore: (file: File) =>
      run(
        () => financeService.restore(file),
        'Finance backup restored. Re-enable push on this device if needed.',
      ),
    upload: (file: File) =>
      run(async () => {
        if (!transaction) return
        await financeService.upload(transaction.id, file)
        setDetail(await financeService.transaction(transaction.id))
      }, 'Receipt attached'),
    export: (format: string, type: string) =>
      run(
        () => financeService.export(effective, format, type),
        'Report downloaded',
      ),
    unread: data?.unreadCount ?? 0,
  }
}
export type FinanceController = ReturnType<typeof useFinance>

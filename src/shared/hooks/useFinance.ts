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
  FinanceReport,
  FinanceWorkbookPreview,
  FinanceReceiptMatch,
} from '../types/finance'
import { EMPTY_FINANCE_FILTER } from '../utils/financePreferences'
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
  const [reports, setReports] = useState<FinanceReport[]>([])
  const [workbook, setWorkbook] = useState<FinanceWorkbookPreview | null>(null)
  const [insightError, setInsightError] = useState('')
  const [receipt, setReceipt] = useState<{
    file: File
    match: FinanceReceiptMatch
  } | null>(null)
  const [metrics, setMetrics] = useState<FinanceMetrics | null>(null)
  const [tab, setTab] = useState<FinanceTab>('Transactions'),
    [filter, setFilter] = useState<FinanceFilter>(
      () => financeService.preferences().filter,
    )
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
    initialSyncAttempted = useRef(false),
    lastAutoSync = useRef(0),
    savedFilter = useRef(filter),
    authorized = useRef(signedIn)
  authorized.current = signedIn
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const load = useCallback(async (signal?: AbortSignal) => {
    const next = await financeService.load(signal)
    if (!signal?.aborted && mounted.current && authorized.current) setData(next)
  }, [])
  useEffect(() => {
    if (!signedIn) {
      initialSyncAttempted.current = false
      revision.current++
      setData(null)
      setReports([])
      setWorkbook(null)
      setReceipt(null)
      setInsightError('')
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
      financeService.reports(controller.signal),
    ])
      .then(([next, stats, recurring, reports]) => {
        if (!controller.signal.aborted) {
          if (!next.items.length && filter.page > 0) {
            setFilter((f) => ({
              ...f,
              page: Math.max(0, Math.ceil(next.total / 50) - 1),
            }))
            return
          }
          setPage(next)
          setMetrics(stats)
          setRecurring(recurring)
          setReports(reports)
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
    if (running.current) return false
    running.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await operation()
      if (mounted.current && authorized.current) {
        await load()
        setMessage(success)
      }
      return true
    } catch (e) {
      if (mounted.current && authorized.current) {
        setError(e instanceof Error ? e.message : 'Finance operation failed')
        // Keep partial imports and the latest sync log visible after a failed operation.
        try {
          await load()
        } catch {
          /* Preserve the original operation error. */
        }
      }
      return false
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
  useEffect(() => {
    if (!active || !signedIn || !data?.configured || !data.initialized) return
    const update = () => {
      if (document.visibilityState === 'hidden' || running.current) return
      const previous = Math.max(
        Date.parse(data.lastSync ?? '') || 0,
        lastAutoSync.current,
      )
      if (Date.now() - previous < 5 * 60_000) return
      lastAutoSync.current = Date.now()
      void run(() => financeService.command('sync'))
    }
    update()
    const timer = window.setInterval(update, 60_000)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [active, signedIn, data?.configured, data?.initialized, data?.lastSync])
  useEffect(() => {
    if (tab === 'Review Inbox') return
    const overview = ['Overview', 'Analytics', 'Accounts'].includes(tab)
    savedFilter.current = overview
      ? { ...savedFilter.current, start: filter.start, end: filter.end }
      : filter
    try {
      financeService.savePreferences(savedFilter.current)
    } catch {
      setMessage(
        'Your filters apply for this session. Browser storage is unavailable, so they could not be saved for next time.',
      )
    }
  }, [filter, tab])
  useEffect(() => {
    if (!transaction || detail?.insight || !data?.insightsAvailable) return
    const id = transaction.id,
      request = revision.current
    let cancelled = false
    setInsightError('')
    void financeService
      .insight(id)
      .then((insight) => {
        if (!cancelled && request === revision.current)
          setDetail((current) =>
            current?.transaction.id === id ? { ...current, insight } : current,
          )
      })
      .catch((e: unknown) => {
        if (!cancelled && request === revision.current)
          setInsightError(
            e instanceof Error ? e.message : 'Merchant description unavailable',
          )
      })
    return () => {
      cancelled = true
    }
  }, [transaction?.id, detail?.insight, data?.insightsAvailable])
  function open(id: string) {
    if (running.current) return
    setInsightError('')
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
        : next === 'Overview' || next === 'Analytics'
          ? {
              ...EMPTY_FINANCE_FILTER,
              start: savedFilter.current.start,
              end: savedFilter.current.end,
            }
          : tab === 'Review Inbox' ||
              (next === 'Transactions' &&
                ['Overview', 'Analytics', 'Accounts'].includes(tab))
            ? { ...savedFilter.current, page: 0 }
            : { ...f, page: 0 },
    )
    setTransaction(null)
  }
  return {
    data,
    page,
    detail,
    recurring,
    reports,
    workbook,
    insightError,
    receipt,
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
    closeWorkbook: () => {
      revision.current++
      setWorkbook(null)
    },
    closeReceipt: () => {
      revision.current++
      setReceipt(null)
    },
    matchReceipt: (file: File) =>
      run(async () => {
        const request = revision.current
        const match = await financeService.matchReceipt(file)
        if (request === revision.current && mounted.current)
          setReceipt({ file, match })
      }),
    attachMatchedReceipt: (id: string) =>
      run(async () => {
        if (!receipt) return
        const request = revision.current
        await financeService.upload(id, receipt.file)
        const detail = await financeService.transaction(id)
        if (request !== revision.current || !mounted.current) return
        setReceipt(null)
        setDetail(detail)
        setTransaction(detail.transaction)
      }, 'Receipt matched and attached'),
    previewWorkbook: (id: string) =>
      run(async () => {
        const request = revision.current
        const preview = await financeService.preview(id)
        if (request === revision.current && mounted.current)
          setWorkbook(preview)
      }),
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
        const request = revision.current
        await financeService.save(transaction.id, input)
        let nextDetail: FinanceDetail | null = null
        if (next) {
          // Query the updated inbox, so reviewed records never loop back into the queue.
          const pending = await financeService.list({
            ...effective,
            review: 'needs-review',
            page: 0,
          })
          const nextId = pending.items.find((t) => t.id !== transaction.id)?.id
          if (nextId) {
            nextDetail = await financeService.transaction(nextId)
            await financeService.command('notifications/read', {
              transactionId: nextId,
            })
          }
        }
        if (request !== revision.current || !mounted.current) return
        setTransaction(nextDetail?.transaction ?? null)
        setDetail(nextDetail)
        setInsightError('')
      }, 'Review saved'),
    createCategory: async (name: string, kind: 'expense' | 'income') => {
      const id = crypto.randomUUID()
      const success = await run(() =>
        financeService.command('categories', {
          id,
          name: name.trim(),
          kind,
          hidden: false,
          color: 'amber',
          parentId: null,
        }),
      )
      return success ? id : null
    },
    describe: () =>
      run(async () => {
        if (!transaction) return
        const id = transaction.id,
          request = revision.current
        await financeService.insight(id)
        const result = await financeService.transaction(id)
        if (request === revision.current && mounted.current) setDetail(result)
      }),
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
        const request = revision.current
        await financeService.upload(transaction.id, file)
        const result = await financeService.transaction(transaction.id)
        if (request === revision.current && mounted.current) setDetail(result)
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

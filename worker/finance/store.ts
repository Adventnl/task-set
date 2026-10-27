import { recurringCandidates } from './recurring'
import { calculateMetrics } from './calculations'
import type {
  FinanceAccount,
  FinanceBalance,
  FinanceBudget,
  FinanceData,
  FinanceEdit,
  FinanceFilter,
  FinancePage,
  FinanceRule,
  FinanceSettings,
  FinanceSync,
  FinanceTransaction,
  FinanceInsight,
  RecurringPayment,
} from '../../src/shared/types/finance'
import { minorUnits, nzDay, totals } from '../../src/shared/utils/finance'
import type { AkahuEnv } from './akahu'
import { FinanceBookkeeping } from './bookkeeping'
import { FinanceSynchronizer } from './synchronizer'
import { merchantInsight } from './insights'
type BodyRow = { body: string }
export class FinanceStore extends FinanceBookkeeping {
  private synchronizer: FinanceSynchronizer
  private insightRequests = new Map<string, Promise<FinanceInsight>>()
  constructor(storage: DurableObjectStorage, env: AkahuEnv) {
    super(storage, env)
    this.initialize()
    this.synchronizer = new FinanceSynchronizer(storage, env)
  }
  savedInsight(id: string): FinanceInsight | null {
    const tx = this.transaction(id)
    const cached = this.read<{ source: string; insight: FinanceInsight }>(
      'settings',
      `insight:${id}`,
    )
    return tx && cached?.source === `${tx.merchant}\n${tx.description}`
      ? cached.insight
      : null
  }
  describe(id: string): Promise<FinanceInsight> {
    const tx = this.transaction(id)
    if (!tx) return Promise.reject(new Error('Transaction not found'))
    const cached = this.savedInsight(id)
    if (cached) return Promise.resolve(cached)
    const pending = this.insightRequests.get(id)
    if (pending) return pending
    const request = merchantInsight(this.env, tx)
      .then((insight) => {
        this.put('settings', `insight:${id}`, {
          source: `${tx.merchant}\n${tx.description}`,
          insight,
        })
        return insight
      })
      .finally(() => {
        this.insightRequests.delete(id)
      })
    this.insightRequests.set(id, request)
    return request
  }
  metrics(filter: FinanceFilter) {
    const all = this.transactions(
      {
        ...filter,
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
      },
      true,
    ).items
    return calculateMetrics(
      this.transactions(filter, true).items,
      all,
      this.list('budgets'),
      nzDay(new Date()),
    )
  }
  recurring(filter: FinanceFilter): RecurringPayment[] {
    const candidates = recurringCandidates(
        this.transactions(filter, true).items,
      ),
      saved = this.list<RecurringPayment>('recurring')
    return [
      ...saved.map((s) => ({
        ...s,
        ...candidates.find((c) => c.id === s.id),
        confirmed: true,
        active: s.active,
        notes: s.notes,
      })),
      ...candidates.filter((c) => !saved.some((s) => s.id === c.id)),
    ]
  }
  confirmRecurring(id: string, active: boolean, notes: string): void {
    const candidate = this.recurring({
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
    }).find((c) => c.id === id)
    if (!candidate) throw new Error('Recurring candidate no longer available')
    this.put('recurring', id, { ...candidate, confirmed: true, active, notes })
  }
  metadata(): FinanceData {
    const stats = this.sql
      .exec<{ count: number; earliest: string | null }>(
        'SELECT COUNT(*) AS count, MIN(date) AS earliest FROM finance_transactions',
      )
      .one()
    return {
      insightsAvailable: !!(this.env.AI || this.env.OPENROUTER_API_KEY),
      configured: !!(this.env.AKAHU_APP_TOKEN && this.env.AKAHU_USER_TOKEN),
      initialized: !!this.read('settings', 'initialized'),
      accounts: this.list('accounts'),
      categories: this.list('categories'),
      rules: this.list('rules'),
      budgets: this.list('budgets'),
      unreadCount: this.sql
        .exec<{ count: number }>(
          'SELECT COUNT(*) AS count FROM finance_notifications WHERE read_at IS NULL',
        )
        .one().count,
      notifications: this.sql
        .exec<{
          id: string
          transactionId: string
          createdAt: string
          readAt: string | null
        }>(
          'SELECT id, transaction_id AS transactionId, created_at AS createdAt, read_at AS readAt FROM finance_notifications ORDER BY created_at DESC LIMIT 200',
        )
        .toArray(),
      balances: this.sql
        .exec<BodyRow>(
          'SELECT body FROM finance_balances ORDER BY observed_at DESC LIMIT 2000',
        )
        .toArray()
        .map((r) => JSON.parse(r.body) as FinanceBalance),
      syncs: this.sql
        .exec<BodyRow>(
          'SELECT body FROM finance_syncs ORDER BY started_at DESC LIMIT 20',
        )
        .toArray()
        .map((r) => JSON.parse(r.body) as FinanceSync),
      transactionCount: stats.count,
      earliest: stats.earliest,
      lastSync: this.read('settings', 'last-sync'),
      refreshRequestedAt: this.read('settings', 'refresh-requested'),
      settings: this.settings(),
      vapidPublicKey: this.env.VAPID_PUBLIC_KEY ?? null,
    }
  }
  transactions(filter: FinanceFilter, unlimited = false): FinancePage {
    // Filtering is server-owned, including the NZ date boundary. SQL narrows candidates before annotation filters.
    const rows = this.sql
      .exec<BodyRow>(
        'SELECT body FROM finance_transactions ORDER BY date ' +
          (filter.oldest ? 'ASC' : 'DESC') +
          ', id',
      )
      .toArray()
    const annotations = new Map(
      this.sql
        .exec<{ transaction_id: string; body: string }>(
          'SELECT transaction_id, body FROM finance_bookkeeping',
        )
        .toArray()
        .map((r) => [r.transaction_id, JSON.parse(r.body) as FinanceEdit]),
    )
    const receipts = new Map(
      this.sql
        .exec<{ transaction_id: string; count: number }>(
          'SELECT transaction_id, COUNT(*) AS count FROM finance_attachments GROUP BY transaction_id',
        )
        .toArray()
        .map((r) => [r.transaction_id, r.count]),
    )
    const items = rows
      .map((r) => {
        const tx = JSON.parse(r.body) as FinanceTransaction
        return {
          ...tx,
          ...annotations.get(tx.id),
          receiptCount: receipts.get(tx.id) ?? 0,
        }
      })
      .filter((t) => {
        const day = nzDay(t.date),
          amount = Math.abs(t.amount),
          search = filter.search.toLowerCase()
        return (
          (!search ||
            `${t.description} ${t.merchant} ${t.notes}`
              .toLowerCase()
              .includes(search)) &&
          (!filter.account || t.accountId === filter.account) &&
          (!filter.category ||
            t.category === filter.category ||
            t.splits.some((s) => s.category === filter.category)) &&
          (!filter.review || t.review === filter.review) &&
          (!filter.start || day >= filter.start) &&
          (!filter.end || day <= filter.end) &&
          (!filter.direction ||
            (filter.direction === 'debit' ? t.amount < 0 : t.amount > 0)) &&
          (!filter.min || amount >= minorUnits(filter.min)) &&
          (!filter.max || amount <= minorUnits(filter.max)) &&
          (!filter.tag || t.tags.includes(filter.tag))
        )
      })
    const summary = totals(items)
    return {
      items: unlimited
        ? items
        : items.slice(filter.page * 50, (filter.page + 1) * 50),
      total: items.length,
      ...summary,
    }
  }
  saveAccount(id: string, included: boolean, archived: boolean): void {
    const a = this.read<FinanceAccount>('accounts', id)
    if (!a) throw new Error('Unknown account')
    this.put('accounts', id, { ...a, included, archived })
  }
  saveRule(r: FinanceRule): void {
    if (!this.read('categories', r.category))
      throw new Error('Invalid category')
    this.put('rules', r.id, r)
  }
  saveBudget(b: FinanceBudget): void {
    if (b.category && !this.read('categories', b.category))
      throw new Error('Invalid category')
    this.put('budgets', b.id, b)
  }
  saveSettings(s: FinanceSettings): void {
    this.put('settings', 'preferences', s)
  }
  markTransactionRead(id: string): void {
    this.sql.exec(
      'UPDATE finance_notifications SET read_at = ? WHERE transaction_id = ?',
      new Date().toISOString(),
      id,
    )
  }
  markRead(id: string): void {
    this.sql.exec(
      'UPDATE finance_notifications SET read_at = ? WHERE id = ?',
      new Date().toISOString(),
      id,
    )
  }
  get syncActive(): boolean {
    return this.synchronizer.syncActive
  }
  sync(): Promise<void> {
    return this.synchronizer.sync()
  }
  refresh(): Promise<void> {
    return this.synchronizer.refresh()
  }
}

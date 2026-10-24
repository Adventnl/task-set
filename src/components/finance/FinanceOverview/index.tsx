import type {
  FinanceData,
  FinanceMetrics,
  FinancePage,
} from '../../../shared/types/finance'
import { financeTime, money } from '../../../shared/utils/finance'
export default function FinanceOverview({
  data,
  page,
  metrics,
  analytics,
  onReview,
  onCategory,
}: {
  data: FinanceData
  metrics: FinanceMetrics | null
  page: FinancePage
  analytics: boolean
  onReview: () => void
  onCategory: (id: string) => void
}) {
  const selected = data.accounts.filter(
    (a) => a.included && !a.archived && a.currency === 'NZD',
  )
  const current =
    selected.every((a) => a.current !== null) && selected.length
      ? selected.reduce((n, a) => n + (a.current ?? 0), 0)
      : null
  const available =
    selected.every((a) => a.available !== null) && selected.length
      ? selected.reduce((n, a) => n + (a.available ?? 0), 0)
      : null
  return (
    <section>
      <p className="finance-eyebrow">
        {analytics ? 'Financial analytics' : 'Your financial position'} · NZD
      </p>
      <div className="finance-metrics">
        <article>
          <span>Current balance</span>
          <strong>{money(current)}</strong>
          <small>Selected NZD accounts</small>
        </article>
        <article>
          <span>Available balance</span>
          <strong>{money(available)}</strong>
          <small>As reported by your bank</small>
        </article>
        <article>
          <span>Income in selected period</span>
          <strong className="finance-income">{money(page.income)}</strong>
          <small>Settled, excluding transfers</small>
        </article>
        <article>
          <span>Expenses in selected period</span>
          <strong>{money(page.expenses)}</strong>
          <small>Net of matched refunds</small>
        </article>
        <article>
          <span>Net cash flow</span>
          <strong>{money(page.income - page.expenses)}</strong>
        </article>
        <article>
          <span>Unread discoveries</span>
          <strong>{data.unreadCount}</strong>
          <button onClick={onReview}>Open review inbox</button>
        </article>
      </div>
      {metrics && (
        <>
          <div className="finance-metrics">
            <article>
              <span>Income detected today</span>
              <strong>{money(metrics.todayIncome)}</strong>
            </article>
            <article>
              <span>Spending detected today</span>
              <strong>{money(metrics.todaySpending)}</strong>
            </article>
            <article>
              <span>This month’s income</span>
              <strong>{money(metrics.monthIncome)}</strong>
            </article>
            <article>
              <span>This month’s expenses</span>
              <strong>{money(metrics.monthExpenses)}</strong>
              <small>
                {metrics.previousExpenses
                  ? `${(((metrics.monthExpenses - metrics.previousExpenses) / Math.abs(metrics.previousExpenses)) * 100).toFixed(1)}% versus full previous month`
                  : 'No previous-month spending recorded'}
              </small>
            </article>
            <article>
              <span>Awaiting your review</span>
              <strong>{metrics.reviewCount}</strong>
              <button onClick={onReview}>Review transactions</button>
            </article>
          </div>
          <h3>Spending in this period</h3>
          {metrics.categories.slice(0, 6).map((c) => (
            <button
              className="finance-bar"
              key={c.id}
              onClick={() => onCategory(c.id)}
            >
              <span>
                {data.categories.find((v) => v.id === c.id)?.name ?? c.id}
              </span>
              <meter
                min="0"
                max={Math.max(1, ...metrics.categories.map((c) => c.amount))}
                value={Math.max(0, c.amount)}
              />
              <strong>{money(c.amount)}</strong>
            </button>
          ))}
        </>
      )}
      <p>Last successful application sync: {financeTime(data.lastSync)}</p>
      <p className="finance-muted">
        Daily bank refreshes can be delayed. Application sync checks cached
        Akahu data; it does not force a bank refresh. Imported history starts{' '}
        {data.earliest ? financeTime(data.earliest) : 'after the first import'}{' '}
        and may be incomplete.
      </p>
      {data.accounts
        .filter((a) => a.status !== 'ACTIVE')
        .map((a) => (
          <p role="status" key={a.id}>
            {a.name}: connection inactive. Reconnect through my.akahu.nz.
          </p>
        ))}
      <h3>Recently recorded transactions</h3>
      {page.items.slice(0, 5).map((t) => (
        <p key={t.id}>
          {t.merchant} <strong>{money(t.amount, t.currency)}</strong> ·{' '}
          {t.status}
        </p>
      ))}
      <p>
        {page.total} transactions match the current dates. Open Transactions to
        inspect or change the selection.
      </p>
      <h3>Category explorer</h3>
      <div className="finance-category-grid">
        {data.categories
          .filter((c) => !c.hidden && c.kind === 'expense')
          .map((c) => (
            <button key={c.id} onClick={() => onCategory(c.id)}>
              {c.name}
            </button>
          ))}
      </div>
    </section>
  )
}

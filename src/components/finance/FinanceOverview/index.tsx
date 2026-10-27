import { ArrowRight, Landmark, ListChecks } from 'lucide-react'
import type {
  FinanceData,
  FinanceMetrics,
  FinancePage,
  FinanceTab,
} from '../../../shared/types/finance'
import { money } from '../../../shared/utils/finance'
import { accountTotals } from '../../../shared/utils/financeDashboard'
import FinanceActivity from '../FinanceActivity'
import FinanceSpendingChart from '../FinanceSpendingChart'
import FinanceCategorySpending from '../FinanceCategorySpending'

export default function FinanceOverview({
  data,
  page,
  metrics,
  loading,
  onNavigate,
  onOpen,
  onCategory,
}: {
  data: FinanceData
  metrics: FinanceMetrics | null
  page: FinancePage
  loading: boolean
  onNavigate: (tab: FinanceTab) => void
  onOpen: (id: string) => void
  onCategory: (id: string) => void
}) {
  const balances = accountTotals(data.accounts)
  const accounts = data.accounts.filter((a) => !a.archived)
  const value = (amount: number | null) => (loading ? '…' : money(amount))
  return (
    <section
      className="finance-overview"
      aria-label="Financial overview"
      aria-busy={loading}
    >
      <div className="finance-kpis">
        <article>
          <span>
            Total balance <small>NZD</small>
          </span>
          <strong>{money(balances.current)}</strong>
          <small>
            {balances.count} included accounts · {money(balances.available)}{' '}
            available
          </small>
        </article>
        <article>
          <span>Money in</span>
          <strong className="finance-income">
            {value(metrics?.income ?? null)}
          </strong>
          <small>Settled receipts in this period</small>
        </article>
        <article>
          <span>Money out</span>
          <strong>{value(metrics?.expenses ?? null)}</strong>
          <small>Spending after matched refunds</small>
        </article>
        <article>
          <span>Net cash flow</span>
          <strong>{value(metrics?.net ?? null)}</strong>
          <small>Money in less money out</small>
        </article>
      </div>
      <div className="finance-dashboard-grid">
        <article className="finance-panel finance-chart-panel">
          <div className="finance-panel-heading">
            <div>
              <h2>Spending over time</h2>
              <p>Recorded daily spending · NZD</p>
            </div>
            <button
              className="finance-link"
              onClick={() => onNavigate('Analytics')}
            >
              Analytics <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
          {loading ? (
            <div className="finance-chart-empty" role="status">
              Loading spending…
            </div>
          ) : (
            <FinanceSpendingChart metrics={metrics} />
          )}
        </article>
        <article className="finance-panel">
          <div className="finance-panel-heading">
            <h2>Your accounts</h2>
            <button
              className="finance-link"
              onClick={() => onNavigate('Accounts')}
            >
              Manage <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
          {!accounts.length && (
            <div className="finance-panel-empty">
              <Landmark size={24} aria-hidden="true" />
              <strong>No accounts imported yet</strong>
              <p>
                Your connected bank accounts will appear after the first
                successful sync.
              </p>
            </div>
          )}
          {accounts.slice(0, 4).map((a) => (
            <button
              key={a.id}
              className="finance-account-row"
              onClick={() => onNavigate('Accounts')}
            >
              <span className="finance-bank-icon" aria-hidden="true">
                <Landmark size={18} />
              </span>
              <span>
                <strong>{a.name}</strong>
                <small>
                  {a.institution} {a.masked}
                  {!a.included ? ' · Excluded' : ''}
                  {a.status !== 'ACTIVE' ? ' · Reconnect needed' : ''}
                </small>
              </span>
              <strong>{money(a.current, a.currency)}</strong>
            </button>
          ))}
          {accounts.length > 4 && (
            <button
              className="finance-link"
              onClick={() => onNavigate('Accounts')}
            >
              View all {accounts.length} accounts
            </button>
          )}
          <button
            className="finance-review-prompt"
            onClick={() => onNavigate('Review Inbox')}
          >
            <ListChecks size={20} aria-hidden="true" />
            <span>
              <strong>
                {loading ? '…' : (metrics?.reviewCount ?? '—')} to review
              </strong>
              <small>Keep your categories up to date</small>
            </span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </article>
        <article className="finance-panel finance-recent-panel">
          <div className="finance-panel-heading">
            <div>
              <h2>Recent transactions</h2>
              <p>{page.total} transactions in this period</p>
            </div>
            <button
              className="finance-link"
              onClick={() => onNavigate('Transactions')}
            >
              View all <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
          {loading || !page.items.length ? (
            <div className="finance-panel-empty">
              <strong>
                {loading
                  ? 'Loading transactions…'
                  : 'No transactions in this period'}
              </strong>
              <p>Choose another date range or sync your connected accounts.</p>
            </div>
          ) : (
            <FinanceActivity
              data={data}
              items={page.items.slice(0, 6)}
              onOpen={onOpen}
            />
          )}
        </article>
        <article className="finance-panel">
          <div className="finance-panel-heading">
            <h2>Spending by category</h2>
            <button
              className="finance-link"
              onClick={() => onNavigate('Budgets & Categories')}
            >
              Budgets <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
          {loading ? (
            <p className="finance-panel-empty">Loading category spending…</p>
          ) : (
            <FinanceCategorySpending
              categories={data.categories}
              values={metrics?.categories ?? []}
              limit={5}
              onCategory={onCategory}
            />
          )}
          {data.budgets
            .filter((b) => !b.archived)
            .slice(0, 2)
            .map((b) => {
              const usage = metrics?.budgetUsage.find((u) => u.id === b.id)
              return (
                <button
                  className="finance-category-row finance-budget-row"
                  key={b.id}
                  onClick={() => onNavigate('Budgets & Categories')}
                >
                  <span>
                    {b.category
                      ? data.categories.find((c) => c.id === b.category)?.name
                      : 'Overall budget'}
                    <small>{b.period}</small>
                  </span>
                  <meter
                    aria-label="Budget used"
                    min="0"
                    max={b.amount}
                    value={Math.max(0, usage?.spent ?? 0)}
                  />
                  <small>
                    {money(usage?.spent ?? 0)} of {money(b.amount)}
                    {usage && usage.spent > b.amount ? ' · Over budget' : ''}
                  </small>
                </button>
              )
            })}
        </article>
      </div>
      <p className="finance-footnote">
        NZD settled transactions. Transfers and excluded items are omitted;
        matched refunds reduce spending. Bank data can be delayed and imported
        history may be incomplete.
      </p>
    </section>
  )
}

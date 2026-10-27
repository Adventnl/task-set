import type {
  FinanceCategory,
  FinanceFilter,
  FinanceMetrics,
  RecurringPayment,
} from '../../../shared/types/finance'
import { money } from '../../../shared/utils/finance'
import FinanceSpendingChart from '../FinanceSpendingChart'
import FinanceCategorySpending from '../FinanceCategorySpending'

export default function FinanceAnalytics({
  metrics: m,
  recurring,
  busy,
  onCommand,
  categories,
  onDrill,
}: {
  metrics: FinanceMetrics | null
  recurring: RecurringPayment[]
  busy: boolean
  onCommand: (path: string, value: unknown) => void
  categories: FinanceCategory[]
  onDrill: (patch: Partial<FinanceFilter>) => void
}) {
  const flowMax = Math.max(
    1,
    ...(m?.months.flatMap((c) => [c.income, Math.abs(c.expenses)]) ?? []),
  )
  return (
    <section aria-label="Financial analytics">
      <div className="finance-kpis">
        <article>
          <span>Money in</span>
          <strong className="finance-income">{money(m?.income ?? null)}</strong>
          <small>Selected period · NZD</small>
        </article>
        <article>
          <span>Money out</span>
          <strong>{money(m?.expenses ?? null)}</strong>
          <small>After matched refunds</small>
        </article>
        <article>
          <span>Net cash flow</span>
          <strong>{money(m?.net ?? null)}</strong>
          <small>Transfers excluded</small>
        </article>
        <article>
          <span>Median expense</span>
          <strong>{money(m?.median ?? null)}</strong>
          <small>Settled spending · NZD</small>
        </article>
      </div>
      <div className="finance-dashboard-grid">
        <article className="finance-panel">
          <div className="finance-panel-heading">
            <div>
              <h2>Daily spending</h2>
              <p>Open the daily amounts to explore a date</p>
            </div>
          </div>
          <FinanceSpendingChart
            metrics={m}
            onDay={(day) => onDrill({ start: day, end: day })}
          />
        </article>
        <article className="finance-panel">
          <div className="finance-panel-heading">
            <h2>Spending by category</h2>
          </div>
          <FinanceCategorySpending
            categories={categories}
            values={m?.categories ?? []}
            onCategory={(id) => onDrill({ category: id })}
          />
        </article>
        <article className="finance-panel">
          <div className="finance-panel-heading">
            <div>
              <h2>Monthly cash flow</h2>
              <p>Money in and money out · NZD</p>
            </div>
          </div>
          {!m?.months.length && (
            <p className="finance-panel-empty">
              No recorded cash flow in this period.
            </p>
          )}
          {m?.months.map((month) => (
            <button
              className="finance-flow-month"
              key={month.id}
              onClick={() =>
                onDrill({
                  start: month.id + '-01',
                  end: new Date(
                    Date.UTC(
                      Number(month.id.slice(0, 4)),
                      Number(month.id.slice(5)),
                      0,
                    ),
                  )
                    .toISOString()
                    .slice(0, 10),
                })
              }
            >
              <strong>{month.id}</strong>
              <span>
                <span>In</span>
                <meter
                  aria-label={`${month.id} money in`}
                  min="0"
                  max={flowMax}
                  value={Math.max(0, month.income)}
                />
                <strong className="finance-income">
                  {money(month.income)}
                </strong>
              </span>
              <span>
                <span>Out</span>
                <meter
                  aria-label={`${month.id} money out`}
                  min="0"
                  max={flowMax}
                  value={Math.max(0, month.expenses)}
                />
                <strong>{money(month.expenses)}</strong>
              </span>
              <small>Net {money(month.income - month.expenses)}</small>
            </button>
          ))}
        </article>
        <article className="finance-panel">
          <div className="finance-panel-heading">
            <h2>Top merchants</h2>
          </div>
          {!m?.merchants.length && (
            <p className="finance-panel-empty">
              No merchant spending in this period.
            </p>
          )}
          {m?.merchants.slice(0, 20).map((v) => (
            <button
              className="finance-merchant-row"
              key={v.id}
              onClick={() => onDrill({ search: v.id })}
            >
              <span>
                <strong>{v.id}</strong>
                <small>{v.count} transactions</small>
              </span>
              <strong>{money(v.amount)}</strong>
            </button>
          ))}
        </article>
      </div>
      <article className="finance-panel finance-recurring-panel">
        <div className="finance-panel-heading">
          <div>
            <h2>Recurring payments</h2>
            <p>
              Estimated dates are predictions. Confirm a candidate to track it
              as a subscription.
            </p>
          </div>
        </div>
        {!recurring.length && (
          <p className="finance-panel-empty">
            Recurring candidates appear when enough payment history is
            available.
          </p>
        )}
        {recurring.map((r) => (
          <div className="finance-recurring-row" key={r.id}>
            <div>
              <strong>{r.merchant}</strong>
              <small>
                {r.frequency} ·{' '}
                {r.confirmed
                  ? r.active
                    ? 'Confirmed'
                    : 'Inactive'
                  : 'Candidate'}
              </small>
            </div>
            <div>
              <strong>{money(r.amount)}</strong>
              <small>Estimated next {r.estimatedNext.slice(0, 10)}</small>
              <small>
                {money(r.monthlyEquivalent)} / month ·{' '}
                {money(r.annualEquivalent)} / year
              </small>
            </div>
            <button
              disabled={busy}
              onClick={() =>
                onCommand('recurring', {
                  id: r.id,
                  active: r.confirmed ? !r.active : true,
                  notes: r.notes,
                })
              }
            >
              {r.confirmed
                ? r.active
                  ? 'Deactivate'
                  : 'Activate'
                : 'Confirm payment'}
            </button>
          </div>
        ))}
      </article>
      <p className="finance-footnote">
        NZD settled transactions only. Transfers are excluded; matched refunds
        reduce expenses. Unclassified credits are receipts, not assertions of
        taxable income. Incomplete history can make comparisons misleading.
      </p>
    </section>
  )
}

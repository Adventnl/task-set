import type {
  FinanceCategory,
  FinanceFilter,
  FinanceMetrics,
  RecurringPayment,
} from '../../../shared/types/finance'
import { money, nzDay } from '../../../shared/utils/finance'
export default function FinanceAnalytics({
  metrics: m,
  recurring,
  busy,
  onCommand,
  categories,
  filter,
  onFilter,
  onDrill,
}: {
  metrics: FinanceMetrics | null
  recurring: RecurringPayment[]
  busy: boolean
  onCommand: (path: string, value: unknown) => void
  categories: FinanceCategory[]
  filter: FinanceFilter
  onFilter: (patch: Partial<FinanceFilter>) => void
  onDrill: (patch: Partial<FinanceFilter>) => void
}) {
  const max = Math.max(
    1,
    ...(m?.categories.map((c) => Math.abs(c.amount)) ?? []),
  )
  return (
    <section>
      <h2>Spending & cash flow</h2>
      <div className="finance-actions">
        <label>
          From
          <input
            type="date"
            value={filter.start}
            onChange={(e) => onFilter({ start: e.target.value })}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={filter.end}
            onChange={(e) => onFilter({ end: e.target.value })}
          />
        </label>
        <button
          onClick={() =>
            onFilter({
              start: nzDay(new Date()).slice(0, 4) + '-01-01',
              end: nzDay(new Date()),
            })
          }
        >
          Year to date
        </button>
        {[7, 30, 90, 180, 365].map((days) => (
          <button
            key={days}
            onClick={() =>
              onFilter({
                start: nzDay(new Date(Date.now() - (days - 1) * 86400000)),
                end: nzDay(new Date()),
              })
            }
          >
            {days} days
          </button>
        ))}
      </div>
      {!m || !m.count ? (
        <p>
          No recorded transactions for this period. Select a period containing
          imported history.
        </p>
      ) : (
        <>
          <p>
            Income {money(m.income)} · Expenses {money(m.expenses)} · Net{' '}
            {money(m.net)}
          </p>
          <p>Median settled expense {money(m.median)}</p>
          <h3>Spending by category</h3>
          {m.categories.map((c) => (
            <button
              className="finance-bar"
              key={c.id}
              onClick={() => onDrill({ category: c.id })}
            >
              <span>{categories.find((v) => v.id === c.id)?.name ?? c.id}</span>
              <meter min="0" max={max} value={Math.max(0, c.amount)} />
              <strong>{money(c.amount)}</strong>
            </button>
          ))}
          <h3>Monthly cash flow</h3>
          {m.months.map((month) => (
            <button
              className="finance-transaction"
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
              <span>{month.id}</span>
              <span>
                In {money(month.income)}
                <br />
                Out {money(month.expenses)}
                <br />
                Net {money(month.income - month.expenses)}
              </span>
            </button>
          ))}
          <h3>Merchant spending</h3>
          {m.merchants.slice(0, 20).map((v) => (
            <button
              className="finance-transaction"
              key={v.id}
              onClick={() => onDrill({ search: v.id })}
            >
              <span>
                {v.id}
                <small>{v.count} transactions</small>
              </span>
              <strong>{money(v.amount)}</strong>
            </button>
          ))}
          <h3>Daily spending</h3>
          {m.daily.map((day) => (
            <button
              className="finance-transaction"
              key={day.id}
              onClick={() => onDrill({ start: day.id, end: day.id })}
            >
              <span>{day.id}</span>
              <strong>{money(day.amount)}</strong>
            </button>
          ))}
        </>
      )}
      <h3>Recurring payment candidates</h3>
      <p>
        Estimated future dates are not bank transactions. Confirm a candidate
        before treating it as a subscription.
      </p>
      {recurring.map((r) => (
        <article key={r.id}>
          <strong>{r.merchant}</strong> · {money(r.amount)} {r.frequency} ·{' '}
          {r.confirmed ? (r.active ? 'Confirmed' : 'Inactive') : 'Candidate'}
          <p>
            Estimated next: {r.estimatedNext.slice(0, 10)} · Monthly equivalent{' '}
            {money(r.monthlyEquivalent)} · Annual {money(r.annualEquivalent)}
          </p>
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
              : 'Confirm recurring payment'}
          </button>
        </article>
      ))}
      <p className="finance-muted">
        NZD settled transactions only. Transfers are excluded; matched refunds
        reduce expenses. Unclassified credits remain receipts and are not
        assertions of taxable income. Incomplete history can make comparisons
        misleading.
      </p>
    </section>
  )
}

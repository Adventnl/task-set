import { useState } from 'react'
import type {
  FinanceBudget,
  FinanceData,
  FinanceMetrics,
} from '../../../shared/types/finance'
import { minorUnits, money, nzDay } from '../../../shared/utils/finance'
import FinanceCategories from '../FinanceCategories'
import FinanceRules from '../FinanceRules'
export default function FinanceBudgets({
  data,
  metrics,
  busy,
  onCommand,
}: {
  data: FinanceData
  metrics: FinanceMetrics | null
  busy: boolean
  onCommand: (path: string, value: unknown) => void
}) {
  const [category, setCategory] = useState('groceries'),
    [amount, setAmount] = useState(''),
    [period, setPeriod] = useState<FinanceBudget['period']>('monthly'),
    [start, setStart] = useState(nzDay(new Date())),
    [id, setId] = useState<string | null>(null),
    [error, setError] = useState('')
  return (
    <section>
      <h2>Budgets</h2>
      <form
        className="finance-filters"
        onSubmit={(e) => {
          e.preventDefault()
          try {
            const cents = minorUnits(amount)
            if (cents <= 0) throw new Error('Enter a positive budget')
            onCommand('budgets', {
              id: id ?? crypto.randomUUID(),
              category: category || null,
              amount: cents,
              period,
              start,
              archived: false,
            })
            setError('')
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Invalid amount')
          }
        }}
      >
        <label>
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Overall spending</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Budget NZ$
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          Period
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as typeof period)}
          >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>
        <label>
          Start date
          <input
            type="date"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <button disabled={busy}>{id ? 'Save budget' : 'Create budget'}</button>
        {id && (
          <button
            type="button"
            onClick={() => {
              setId(null)
              setAmount('')
            }}
          >
            New budget
          </button>
        )}
      </form>
      {error && <p role="alert">{error}</p>}
      {data.budgets.map((b) => {
        const usage = metrics?.budgetUsage.find((u) => u.id === b.id)
        return (
          <article className="finance-account" key={b.id}>
            <strong>
              {data.categories.find((c) => c.id === b.category)?.name ??
                'Overall spending'}
            </strong>
            <p>
              {money(b.amount)} {b.period} ·{' '}
              {b.archived ? 'Archived' : 'Active'}
            </p>
            {usage && (
              <>
                <meter
                  min="0"
                  max={b.amount}
                  value={Math.min(b.amount, Math.max(0, usage.spent))}
                />
                <p>
                  Spent {money(usage.spent)} · Remaining{' '}
                  {money(b.amount - usage.spent)} ·{' '}
                  {((usage.spent / b.amount) * 100).toFixed(1)}% used
                </p>
                <small>
                  {usage.start} – {usage.end}
                  {usage.spent > b.amount ? ' · Over budget' : ''}
                </small>
              </>
            )}
            <div className="finance-actions">
              <button
                disabled={busy}
                onClick={() =>
                  onCommand('budgets', { ...b, archived: !b.archived })
                }
              >
                {b.archived ? 'Restore' : 'Archive'}
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setId(b.id)
                  setCategory(b.category ?? '')
                  setAmount(String(b.amount / 100))
                  setPeriod(b.period)
                  setStart(b.start)
                }}
              >
                Edit
              </button>
            </div>
          </article>
        )
      })}
      <FinanceCategories
        categories={data.categories}
        busy={busy}
        onCommand={onCommand}
      />
      <FinanceRules data={data} busy={busy} onCommand={onCommand} />
    </section>
  )
}

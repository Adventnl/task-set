import { useState } from 'react'
import type {
  FinanceData,
  FinanceFilter,
  FinancePage,
} from '../../../shared/types/finance'
import { financeTime, money } from '../../../shared/utils/finance'
export default function FinanceTransactions({
  data,
  page,
  filter,
  onFilter,
  onOpen,
  onBulk,
  busy,
}: {
  data: FinanceData
  busy: boolean
  onBulk: (ids: string[], category: string) => void
  page: FinancePage
  filter: FinanceFilter
  onFilter: (patch: Partial<FinanceFilter>) => void
  onOpen: (id: string) => void
}) {
  const [selected, setSelected] = useState<string[]>([]),
    [bulkCategory, setBulkCategory] = useState('')
  return (
    <section aria-label="Transaction explorer">
      <div className="finance-filters">
        <label>
          Search
          <input
            value={filter.search}
            onChange={(e) => onFilter({ search: e.target.value })}
            placeholder="Merchant, description or notes"
          />
        </label>
        <label>
          Account
          <select
            value={filter.account}
            onChange={(e) => onFilter({ account: e.target.value })}
          >
            <option value="">All accounts</option>
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select
            value={filter.category}
            onChange={(e) => onFilter({ category: e.target.value })}
          >
            <option value="">All categories</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
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
        <label>
          Review
          <select
            value={filter.review}
            onChange={(e) => onFilter({ review: e.target.value })}
          >
            <option value="">All states</option>
            <option value="needs-review">Needs Review</option>
            <option value="reviewed">Reviewed</option>
            <option value="later">Review Later</option>
            <option value="ignored">Ignored</option>
          </select>
        </label>
        <label>
          Direction
          <select
            value={filter.direction}
            onChange={(e) => onFilter({ direction: e.target.value })}
          >
            <option value="">Both</option>
            <option value="debit">Spending</option>
            <option value="credit">Money received</option>
          </select>
        </label>
        <label>
          Minimum NZ$
          <input
            type="number"
            min="0"
            step="0.01"
            value={filter.min}
            onChange={(e) => onFilter({ min: e.target.value })}
          />
        </label>
        <label>
          Maximum NZ$
          <input
            type="number"
            min="0"
            step="0.01"
            value={filter.max}
            onChange={(e) => onFilter({ max: e.target.value })}
          />
        </label>
        <label>
          Tag
          <input
            value={filter.tag}
            onChange={(e) => onFilter({ tag: e.target.value })}
          />
        </label>
        <label>
          Order
          <select
            value={String(filter.oldest)}
            onChange={(e) => onFilter({ oldest: e.target.value === 'true' })}
          >
            <option value="false">Newest first</option>
            <option value="true">Oldest first</option>
          </select>
        </label>
      </div>
      <p>
        {page.total} matching transactions · Income {money(page.income)} ·
        Expenses {money(page.expenses)}
      </p>
      <p className="finance-muted">
        Totals use settled NZD transactions, exclude confirmed transfers and
        offset matched refunds. Pending payments remain separate.
      </p>
      {!page.items.length && (
        <p className="finance-empty">
          No transactions in this selection. Adjust the dates or check available
          bank data.
        </p>
      )}
      <div className="finance-actions">
        <select
          aria-label="Bulk category"
          value={bulkCategory}
          onChange={(e) => setBulkCategory(e.target.value)}
        >
          <option value="">Keep current categories</option>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          disabled={busy || !selected.length}
          onClick={() => {
            onBulk(selected, bulkCategory)
            setSelected([])
          }}
        >
          Mark {selected.length} reviewed
        </button>
      </div>
      <div className="finance-transactions">
        {page.items.map((t) => (
          <div key={t.id} className="finance-select-row">
            <input
              type="checkbox"
              aria-label={`Select ${t.merchant}`}
              checked={selected.includes(t.id)}
              onChange={(e) =>
                setSelected((ids) =>
                  e.target.checked
                    ? [...ids, t.id]
                    : ids.filter((id) => id !== t.id),
                )
              }
            />
            <button
              type="button"
              className="finance-transaction"
              key={t.id}
              onClick={() => onOpen(t.id)}
            >
              <span>
                <strong>{t.merchant}</strong>
                <small>
                  {financeTime(t.date)} ·{' '}
                  {data.accounts.find((a) => a.id === t.accountId)?.name}
                </small>
                <small>
                  {data.categories.find((c) => c.id === t.category)?.name} ·{' '}
                  {t.review}
                  {t.ruleId ? ' · Rule categorised' : ''} {t.tags.join(' · ')}
                </small>
              </span>
              <span>
                <strong className={t.amount > 0 ? 'finance-income' : ''}>
                  {money(t.amount, t.currency)}
                </strong>
                <small>{t.status}</small>
              </span>
            </button>
          </div>
        ))}
      </div>
      <div className="finance-actions">
        <button
          disabled={filter.page === 0}
          onClick={() => onFilter({ page: filter.page - 1 })}
        >
          Previous
        </button>
        <span>Page {filter.page + 1}</span>
        <button
          disabled={(filter.page + 1) * 50 >= page.total}
          onClick={() => onFilter({ page: filter.page + 1 })}
        >
          Next
        </button>
      </div>
    </section>
  )
}

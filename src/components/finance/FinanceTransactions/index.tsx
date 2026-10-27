import { useState } from 'react'
import type {
  FinanceData,
  FinanceFilter,
  FinancePage,
} from '../../../shared/types/finance'
import { money } from '../../../shared/utils/finance'
import FinanceActivity from '../FinanceActivity'

export default function FinanceTransactions({
  data,
  page,
  filter,
  onFilter,
  onOpen,
  onBulk,
  busy,
  loading,
}: {
  data: FinanceData
  page: FinancePage
  filter: FinanceFilter
  busy: boolean
  loading: boolean
  onFilter: (patch: Partial<FinanceFilter>) => void
  onOpen: (id: string) => void
  onBulk: (ids: string[], category: string) => void
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [bulkCategory, setBulkCategory] = useState('')
  // Only visible selections can be acted on after a filter or page change.
  const visibleSelected = selected.filter((id) =>
    page.items.some((t) => t.id === id),
  )
  const advancedCount = [
    filter.review,
    filter.direction,
    filter.min,
    filter.max,
    filter.tag,
    filter.oldest,
  ].filter(Boolean).length
  return (
    <section
      className="finance-panel finance-register"
      aria-label="Transaction explorer"
      aria-busy={loading}
    >
      <div className="finance-filters finance-quick-filters">
        <label>
          Search
          <input
            type="search"
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
      </div>
      <details className="finance-advanced-filters">
        <summary>
          More filters{advancedCount ? ` (${advancedCount} active)` : ''}
        </summary>
        <div className="finance-filters">
          <label>
            Review
            <select
              value={filter.review || 'all'}
              onChange={(e) => onFilter({ review: e.target.value })}
            >
              <option value="all">All states</option>
              <option value="needs-review">Needs review</option>
              <option value="reviewed">Reviewed</option>
              <option value="later">Review later</option>
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
      </details>
      <div className="finance-register-summary">
        <strong>{loading ? 'Loading…' : `${page.total} transactions`}</strong>
        <span>
          In {money(page.income)} · Out {money(page.expenses)}
        </span>
      </div>
      {!!visibleSelected.length && (
        <div className="finance-actions finance-bulk-actions">
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
            disabled={busy || loading}
            onClick={() => {
              onBulk(visibleSelected, bulkCategory)
              setSelected([])
            }}
          >
            Mark {visibleSelected.length} reviewed
          </button>
        </div>
      )}
      {!page.items.length ? (
        <div className="finance-panel-empty">
          <strong>
            {loading ? 'Loading transactions…' : 'No matching transactions'}
          </strong>
          <p>
            Try a wider date range, change your filters, or sync your accounts.
          </p>
        </div>
      ) : (
        <FinanceActivity
          data={data}
          items={page.items}
          onOpen={onOpen}
          selected={visibleSelected}
          onSelect={(id, checked) =>
            setSelected((ids) =>
              checked ? [...ids, id] : ids.filter((v) => v !== id),
            )
          }
        />
      )}
      <div className="finance-pagination">
        <span>Page {filter.page + 1}</span>
        <div>
          <button
            disabled={loading || filter.page === 0}
            onClick={() => onFilter({ page: filter.page - 1 })}
          >
            Previous
          </button>
          <button
            disabled={loading || (filter.page + 1) * 50 >= page.total}
            onClick={() => onFilter({ page: filter.page + 1 })}
          >
            Next
          </button>
        </div>
      </div>
      <p className="finance-footnote">
        Totals use settled NZD transactions, exclude confirmed transfers and
        offset matched refunds. Pending payments remain separate.
      </p>
    </section>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import type {
  FinanceData,
  FinanceFilter,
  FinancePage,
} from '../../../shared/types/finance'
import FinancePagination from '../FinancePagination'
import { money } from '../../../shared/utils/finance'
import FinanceActivity from '../FinanceActivity'

export default function FinanceTransactions({
  data,
  page,
  filter,
  onFilter,
  onOpen,
  onBulk,
  onReceipt,
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
  onReceipt: (file: File) => void
  onBulk: (ids: string[], category: string) => Promise<boolean>
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [bulkCategory, setBulkCategory] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const registerRef = useRef<HTMLElement>(null)
  const lastPage = useRef(filter.page)
  useEffect(() => {
    if (lastPage.current !== filter.page)
      registerRef.current?.scrollIntoView({ block: 'start' })
    lastPage.current = filter.page
  }, [filter.page])
  // Only visible selections can be acted on after a filter or page change.
  const visibleSelected = selected.filter((id) =>
    page.items.some((t) => t.id === id),
  )
  const advancedCount = [
    filter.account,
    filter.category,
    filter.review === 'all' ? '' : filter.review,
    filter.direction,
    filter.min,
    filter.max,
    filter.tag,
    filter.oldest,
  ].filter(Boolean).length
  const filterKey = JSON.stringify(filter)
  useEffect(() => {
    setSelected([])
  }, [filterKey])
  return (
    <section
      ref={registerRef}
      className="finance-panel finance-register"
      aria-label="Transaction explorer"
      aria-busy={loading}
    >
      <div className="finance-mail-toolbar">
        <div className="finance-mail-selection">
          <label className="finance-upload-button">
            Match receipt
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onReceipt(file)
                e.target.value = ''
              }}
            />
          </label>
        </div>
        <div className="finance-actions">
          <button
            aria-pressed={
              !filter.category && (!filter.review || filter.review === 'all')
            }
            onClick={() => onFilter({ category: '', review: 'all' })}
          >
            All transactions
          </button>
          <button
            aria-pressed={filter.category === 'uncategorized'}
            onClick={() =>
              onFilter({
                category: 'uncategorized',
                review: 'all',
                start: '',
                end: '',
              })
            }
          >
            Uncategorised
          </button>
          <button
            aria-pressed={filter.review === 'needs-review'}
            onClick={() => onFilter({ category: '', review: 'needs-review' })}
          >
            Needs review
          </button>
        </div>
      </div>
      <div className="finance-filter-toolbar">
        <div className="finance-filters finance-quick-filters">
          <label className="finance-search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Search transactions</span>
            <input
              type="search"
              value={filter.search}
              onChange={(e) => onFilter({ search: e.target.value })}
              placeholder="Merchant, description or notes"
            />
          </label>
        </div>
        <button
          className="finance-filter-toggle"
          aria-expanded={filtersOpen}
          aria-controls="finance-filter-fields"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          Filters{advancedCount ? ` (${advancedCount})` : ''}
        </button>
      </div>
      {(filter.category ||
        filter.account ||
        filter.search ||
        (filter.review && filter.review !== 'all') ||
        filter.direction ||
        filter.min ||
        filter.max ||
        filter.tag ||
        filter.oldest) && (
        <div
          className="finance-filter-chips"
          aria-label="Active transaction filters"
        >
          {filter.category && (
            <button
              onClick={() => onFilter({ category: '' })}
              aria-label="Clear category filter"
            >
              {data.categories.find((c) => c.id === filter.category)?.name ??
                'Category'}
              <X size={13} aria-hidden="true" />
            </button>
          )}
          {filter.account && (
            <button
              onClick={() => onFilter({ account: '' })}
              aria-label="Clear account filter"
            >
              {data.accounts.find((a) => a.id === filter.account)?.name ??
                'Account'}
              <X size={13} aria-hidden="true" />
            </button>
          )}
          <button
            className="finance-link"
            onClick={() =>
              onFilter({
                category: '',
                account: '',
                search: '',
                review: 'all',
                direction: '',
                min: '',
                max: '',
                tag: '',
                oldest: false,
              })
            }
          >
            Clear filters
          </button>
        </div>
      )}
      {filtersOpen && (
        <div className="finance-advanced-filters" id="finance-filter-fields">
          <div className="finance-filters">
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
                onChange={(e) =>
                  onFilter({ oldest: e.target.value === 'true' })
                }
              >
                <option value="false">Newest first</option>
                <option value="true">Oldest first</option>
              </select>
            </label>
          </div>
        </div>
      )}
      <div className="finance-register-summary">
        <div className="finance-register-selection">
          {' '}
          <label className="finance-check">
            <input
              type="checkbox"
              aria-label="Select all transactions on this page"
              disabled={loading || !page.items.length}
              checked={
                !!page.items.length &&
                visibleSelected.length === page.items.length
              }
              ref={(input) => {
                if (input)
                  input.indeterminate =
                    visibleSelected.length > 0 &&
                    visibleSelected.length < page.items.length
              }}
              onChange={(e) =>
                setSelected(e.target.checked ? page.items.map((t) => t.id) : [])
              }
            />
            {visibleSelected.length
              ? `${visibleSelected.length} selected`
              : 'Select page'}
          </label>
          <strong>{loading ? 'Loading…' : `${page.total} transactions`}</strong>
        </div>
        <span>
          In {money(page.income)} · Out {money(page.expenses)}
        </span>
      </div>
      <FinancePagination
        page={filter.page}
        total={page.total}
        loading={loading}
        onPage={(page) => onFilter({ page })}
      />
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
            onClick={async () => {
              if (await onBulk(visibleSelected, bulkCategory)) setSelected([])
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
          <p>Try a wider date range or clear your filters.</p>
          {!loading && (
            <button
              onClick={() =>
                onFilter({
                  start: '',
                  end: '',
                  search: '',
                  category: '',
                  account: '',
                  review: 'all',
                  direction: '',
                  min: '',
                  max: '',
                  tag: '',
                  oldest: false,
                })
              }
            >
              Show all transactions
            </button>
          )}
        </div>
      ) : (
        <FinanceActivity
          data={data}
          disabled={loading || busy}
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
      <FinancePagination
        page={filter.page}
        total={page.total}
        loading={loading}
        onPage={(page) => onFilter({ page })}
      />
      <p className="finance-footnote">
        Totals use settled NZD transactions, exclude confirmed transfers and
        offset matched refunds. Pending payments remain separate.
      </p>
    </section>
  )
}

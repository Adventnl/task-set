import { useState } from 'react'
import { ArrowUpRight, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import type { FinanceCategory } from '../../../shared/types/finance'
import Modal from '../../app/Modal'
import FinancePagination from '../FinancePagination'

export default function FinanceCategories({
  categories,
  counts,
  busy,
  error,
  onCommand,
  onOpen,
  onDelete,
}: {
  categories: FinanceCategory[]
  counts: Record<string, number>
  busy: boolean
  error: string
  onCommand: (path: string, value: unknown) => Promise<boolean>
  onOpen: (id: string) => void
  onDelete: (id: string, replacement: string) => Promise<boolean>
}) {
  const [editing, setEditing] = useState<FinanceCategory | 'new' | null>(null)
  const [deleting, setDeleting] = useState<FinanceCategory | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<FinanceCategory['kind']>('expense')
  const [hidden, setHidden] = useState(false)
  const [replacement, setReplacement] = useState('uncategorized')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const matches = categories.filter((c) =>
    c.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  )
  const current = Math.min(
    page,
    Math.max(0, Math.ceil(matches.length / 20) - 1),
  )
  function edit(category: FinanceCategory | 'new') {
    setEditing(category)
    setName(category === 'new' ? '' : category.name)
    setKind(category === 'new' ? 'expense' : category.kind)
    setHidden(category === 'new' ? false : category.hidden)
  }
  return (
    <section className="finance-panel finance-category-manager">
      <div className="finance-panel-heading">
        <div>
          <h2>
            Your categories{' '}
            <span className="finance-count">{categories.length}</span>
          </h2>
          <p>Open a category to see its transactions across all history.</p>
        </div>
        <button
          className="finance-primary"
          disabled={busy}
          onClick={() => edit('new')}
        >
          <Plus size={16} aria-hidden="true" />
          New category
        </button>
      </div>
      <label className="finance-search">
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">Search categories</span>
        <input
          type="search"
          placeholder="Find a category…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
        />
      </label>
      <div
        className="finance-category-table"
        role="table"
        aria-label="Categories"
      >
        <div className="finance-category-table-head" role="row">
          <span role="columnheader">Category</span>
          <span role="columnheader">Transactions</span>
          <span role="columnheader">Actions</span>
        </div>
        {matches.slice(current * 20, (current + 1) * 20).map((c) => (
          <div className="finance-category-table-row" key={c.id} role="row">
            <div role="cell">
              <button
                className="finance-category-open"
                onClick={() => onOpen(c.id)}
              >
                <strong>{c.name}</strong>
                <ArrowUpRight size={15} aria-hidden="true" />
              </button>
              <span className="finance-category-meta">
                {c.kind === 'special' ? 'Other' : c.kind}
                {c.hidden ? ' · Hidden' : ''}
              </span>
            </div>
            <div role="cell">
              <button
                className="finance-link"
                onClick={() => onOpen(c.id)}
                aria-label={`View ${counts[c.id] ?? 0} transactions in ${c.name}`}
              >
                {counts[c.id] ?? 0}
              </button>
            </div>
            <div className="finance-row-actions" role="cell">
              <button
                onClick={() => edit(c)}
                disabled={busy}
                aria-label={`Edit ${c.name}`}
                title="Edit category"
              >
                <Pencil size={16} />
              </button>
              <button
                className="finance-danger"
                disabled={busy}
                onClick={() => {
                  setDeleting(c)
                  setReplacement('uncategorized')
                }}
                aria-label={`Delete ${c.name}`}
                title="Delete category"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {!matches.length && (
        <div className="finance-panel-empty">
          <strong>
            {categories.length
              ? 'No matching categories'
              : 'Organise your transactions'}
          </strong>
          <p>
            {categories.length
              ? 'Try a different name or clear your search.'
              : 'Create your first category here or while reviewing a transaction.'}
          </p>
          {!!search && (
            <button onClick={() => setSearch('')}>Clear search</button>
          )}
        </div>
      )}
      <FinancePagination
        page={current}
        total={matches.length}
        size={20}
        noun="categories"
        loading={busy}
        onPage={setPage}
      />
      {!!counts.uncategorized && (
        <div className="finance-section-footer">
          <span>{counts.uncategorized} transactions still need a category</span>
          <button
            className="finance-link"
            onClick={() => onOpen('uncategorized')}
          >
            View uncategorised <ArrowUpRight size={15} />
          </button>
        </div>
      )}
      {editing && (
        <Modal
          labelledBy="category-editor-title"
          onClose={() => {
            if (!busy) setEditing(null)
          }}
        >
          <form
            className="finance-review"
            onSubmit={async (e) => {
              e.preventDefault()
              const existing = editing === 'new' ? null : editing
              if (
                await onCommand('categories', {
                  id: existing?.id ?? crypto.randomUUID(),
                  name: name.trim(),
                  kind,
                  hidden,
                  color: existing?.color ?? 'amber',
                  parentId: existing?.parentId ?? null,
                })
              )
                setEditing(null)
            }}
          >
            <h2 id="category-editor-title">
              {editing === 'new' ? 'New category' : 'Edit category'}
            </h2>
            <label>
              Name
              <input
                autoFocus
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Type
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="special">Other</option>
              </select>
            </label>
            <label className="finance-check">
              <input
                type="checkbox"
                checked={hidden}
                onChange={(e) => setHidden(e.target.checked)}
              />
              Hide from category choices
            </label>
            {error && (
              <p role="alert" className="finance-error">
                {error}
              </p>
            )}
            <div className="finance-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                className="finance-primary"
                disabled={busy || !name.trim()}
              >
                {busy ? 'Saving…' : 'Save category'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal
          labelledBy="category-delete-title"
          onClose={() => {
            if (!busy) setDeleting(null)
          }}
        >
          <div className="finance-review">
            <h2 id="category-delete-title">Delete “{deleting.name}”?</h2>
            <p>
              Keep all {counts[deleting.id] ?? 0} transactions. Choose where to
              move their category assignments, including splits.
            </p>
            <label>
              Move transactions to
              <select
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
              >
                <option value="uncategorized">Uncategorised</option>
                {categories
                  .filter((c) => c.id !== deleting.id)
                  .map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <p className="finance-muted">
              {replacement === 'uncategorized'
                ? 'Related rules will be disabled and budgets archived.'
                : 'Related rules and budgets will also move to this category.'}{' '}
              Notes, review status and bank records are kept.
            </p>
            {error && (
              <p className="finance-error" role="alert">
                {error}
              </p>
            )}
            <div className="finance-actions">
              <button
                autoFocus
                disabled={busy}
                onClick={() => setDeleting(null)}
              >
                Cancel
              </button>
              <button
                className="finance-danger"
                disabled={busy}
                onClick={async () => {
                  if (await onDelete(deleting.id, replacement))
                    setDeleting(null)
                }}
              >
                {busy ? 'Deleting…' : 'Delete category'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}

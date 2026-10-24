import { useState } from 'react'
import type { FinanceCategory } from '../../../shared/types/finance'
export default function FinanceCategories({
  categories,
  busy,
  onCommand,
}: {
  categories: FinanceCategory[]
  busy: boolean
  onCommand: (path: string, value: unknown) => void
}) {
  const [editing, setEditing] = useState<FinanceCategory | null>(null),
    [name, setName] = useState(''),
    [parent, setParent] = useState(''),
    [kind, setKind] = useState<FinanceCategory['kind']>('expense'),
    [color, setColor] = useState('amber'),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('')
  return (
    <section>
      <h2>Categories</h2>
      <form
        className="finance-filters"
        onSubmit={(e) => {
          e.preventDefault()
          onCommand('categories', {
            id: editing?.id ?? crypto.randomUUID(),
            name: name.trim(),
            kind,
            hidden: editing?.hidden ?? false,
            color,
            parentId: parent || null,
          })
          setName('')
          setEditing(null)
        }}
      >
        <label>
          Name
          <input
            required
            aria-label="New category name"
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
            <option value="special">Special</option>
          </select>
        </label>
        <label>
          Parent
          <select value={parent} onChange={(e) => setParent(e.target.value)}>
            <option value="">No parent</option>
            {categories
              .filter((c) => c.id !== editing?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Colour
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#b88930'}
            onChange={(e) => setColor(e.target.value)}
          />
        </label>
        <button disabled={busy}>
          {editing ? 'Save category' : 'Add category'}
        </button>
      </form>
      <div className="finance-category-grid">
        {categories.map((c) => (
          <span key={c.id}>
            <button
              disabled={busy}
              onClick={() => {
                setEditing(c)
                setName(c.name)
                setParent(c.parentId ?? '')
                setKind(c.kind)
                setColor(c.color)
              }}
            >
              {c.name}
            </button>
            <button
              aria-label={`${c.hidden ? 'Show' : 'Hide'} ${c.name}`}
              disabled={busy}
              onClick={() =>
                onCommand('categories', { ...c, hidden: !c.hidden })
              }
            >
              {c.hidden ? 'Show' : 'Hide'}
            </button>
          </span>
        ))}
      </div>
      <h3>Merge categories</h3>
      <p>
        Choose two categories of the same type. The source is hidden;
        transactions, splits, rules and budgets are retained.
      </p>
      <div className="finance-actions">
        <select
          aria-label="Merge from"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        >
          <option value="">From category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Merge into"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        >
          <option value="">Into category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          disabled={busy || !from || !to || from === to}
          onClick={() => onCommand('categories/merge', { from, to })}
        >
          Confirm category merge
        </button>
      </div>
    </section>
  )
}

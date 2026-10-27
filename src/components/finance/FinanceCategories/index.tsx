import { useState } from 'react'
import type { FinanceCategory } from '../../../shared/types/finance'
export default function FinanceCategories({
  categories,
  busy,
  onCommand,
}: {
  categories: FinanceCategory[]
  busy: boolean
  onCommand: (path: string, value: unknown) => Promise<boolean>
}) {
  const [editing, setEditing] = useState<FinanceCategory | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<FinanceCategory['kind']>('expense')
  return (
    <section className="finance-panel finance-category-manager">
      <div className="finance-panel-heading">
        <div>
          <h2>Your categories</h2>
          <p>
            Create the categories you use. They are saved to your private
            database.
          </p>
        </div>
      </div>
      <form
        className="finance-filters"
        onSubmit={async (e) => {
          e.preventDefault()
          const saved = await onCommand('categories', {
            id: editing?.id ?? crypto.randomUUID(),
            name: name.trim(),
            kind,
            hidden: editing?.hidden ?? false,
            color: editing?.color ?? 'amber',
            parentId: editing?.parentId ?? null,
          })
          if (saved) {
            setName('')
            setEditing(null)
          }
        }}
      >
        <label>
          Name
          <input
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Food expenses"
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
        <button disabled={busy || !name.trim()}>
          {editing ? 'Save category' : 'Create category'}
        </button>
        {editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(null)
              setName('')
            }}
          >
            New category
          </button>
        )}
      </form>
      {!categories.length && (
        <p>
          No categories yet. You can also create one while reviewing a
          transaction.
        </p>
      )}
      <div className="finance-category-list">
        {categories.map((c) => (
          <div key={c.id}>
            <button
              onClick={() => {
                setEditing(c)
                setName(c.name)
                setKind(c.kind)
              }}
            >
              {c.name}
              <small>
                {c.kind}
                {c.hidden ? ' - Hidden' : ''}
              </small>
            </button>
            {editing?.id === c.id && (
              <label className="finance-check">
                <input
                  type="checkbox"
                  checked={c.hidden}
                  disabled={busy}
                  onChange={(e) =>
                    onCommand('categories', { ...c, hidden: e.target.checked })
                  }
                />
                Hide from category choices
              </label>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

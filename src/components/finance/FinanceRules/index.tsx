import { useState } from 'react'
import type { FinanceData, FinanceRule } from '../../../shared/types/finance'
export default function FinanceRules({
  data,
  busy,
  onCommand,
}: {
  data: FinanceData
  busy: boolean
  onCommand: (path: string, value: unknown) => void
}) {
  const [text, setText] = useState(''),
    [category, setCategory] = useState(''),
    [match, setMatch] = useState<FinanceRule['match']>('contains'),
    [direction, setDirection] = useState<FinanceRule['direction']>('any'),
    [account, setAccount] = useState(''),
    [priority, setPriority] = useState(100)
  return (
    <section>
      <h2>Approved categorisation rules</h2>
      <p>
        Explicit transaction categories take precedence. Rules run in descending
        priority, then by ID. They only affect newly imported transactions.
      </p>
      <form
        className="finance-filters"
        onSubmit={(e) => {
          e.preventDefault()
          onCommand('rules', {
            id: crypto.randomUUID(),
            text,
            match,
            category,
            priority,
            enabled: true,
            accountId: account || null,
            direction,
          })
          setText('')
        }}
      >
        <label>
          Merchant or description
          <input
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <label>
          Match
          <select
            value={match}
            onChange={(e) => setMatch(e.target.value as typeof match)}
          >
            <option value="contains">Contains keyword</option>
            <option value="exact">Exact merchant</option>
          </select>
        </label>
        <label>
          Category
          <select
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Choose your category</option>
            {data.categories
              .filter((c) => c.id !== 'uncategorized' && !c.hidden)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Account
          <select value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value="">All accounts</option>
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Direction
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as typeof direction)}
          >
            <option value="any">Any</option>
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>
        </label>
        <label>
          Priority
          <input
            type="number"
            step="1"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
          />
        </label>
        <button disabled={busy || !category}>Approve rule</button>
      </form>
      {data.rules.map((r) => (
        <p key={r.id}>
          {r.text} → {data.categories.find((c) => c.id === r.category)?.name} ·
          priority {r.priority}{' '}
          <button
            disabled={busy}
            onClick={() => onCommand('rules', { ...r, enabled: !r.enabled })}
          >
            {r.enabled ? 'Disable' : 'Enable'}
          </button>
        </p>
      ))}
    </section>
  )
}

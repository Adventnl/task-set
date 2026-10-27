import { useState } from 'react'
import Modal from '../../app/Modal'
import type {
  FinanceCategory,
  FinanceDetail,
  FinanceEdit,
  FinanceTransaction,
} from '../../../shared/types/finance'
import { financeTime, minorUnits, money } from '../../../shared/utils/finance'
export default function FinanceReview({
  transaction: t,
  categories,
  detail,
  busy,
  error,
  onClose,
  onSave,
  onMatch,
  onUpload,
  onCreateCategory,
  onDescribe,
  accountLabel,
  insightError,
}: {
  onCreateCategory: (
    name: string,
    kind: 'expense' | 'income',
  ) => Promise<string | null>
  onDescribe: () => void
  insightError: string
  accountLabel: string
  transaction: FinanceTransaction
  categories: FinanceCategory[]
  detail: FinanceDetail | null
  onUpload: (file: File) => void
  busy: boolean
  error: string
  onClose: () => void
  onSave: (input: FinanceEdit, next: boolean) => void
  onMatch: (other: string, kind: 'transfer' | 'refund') => void
}) {
  const [categoryName, setCategoryName] = useState('')
  const [category, setCategory] = useState(t.category),
    [notes, setNotes] = useState(t.notes),
    [tags, setTags] = useState(t.tags.join(', ')),
    [createRule, setCreateRule] = useState(false),
    [excluded, setExcluded] = useState(t.excluded)
  const [splits, setSplits] = useState(t.splits),
    [matchId, setMatchId] = useState(''),
    [splitError, setSplitError] = useState('')
  function save(review: FinanceEdit['review'], next: boolean) {
    onSave(
      {
        category,
        notes,
        tags: tags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        review,
        excluded,
        transferId: null,
        refundId: null,
        splits,
        createRule,
      },
      next,
    )
  }
  return (
    <Modal labelledBy="finance-review-title" onClose={onClose}>
      <div className="finance-review">
        {error && (
          <p className="finance-error" role="alert">
            {error}
          </p>
        )}
        <button className="finance-close" onClick={onClose}>
          Close
        </button>
        <p className="finance-eyebrow">{accountLabel}</p>
        <h3>{t.merchant}</h3>
        <h2 id="finance-review-title">{money(t.amount, t.currency)}</h2>
        <p>
          {financeTime(t.date)} · {t.status}
        </p>
        <h3>What was this transaction for?</h3>
        {t.upstreamMissingAt && (
          <p role="status">
            Not returned in the latest complete bank-history scan. This may be a
            correction, replacement or access change. The retained record has
            not been deleted; investigate before excluding it.
          </p>
        )}
        <div
          className="finance-category-choices"
          role="group"
          aria-label="Choose category"
        >
          {categories
            .filter((c) => c.id !== 'uncategorized' && !c.hidden)
            .map((c) => (
              <button
                key={c.id}
                aria-pressed={category === c.id}
                onClick={() => setCategory(c.id)}
                disabled={busy}
              >
                {c.name}
              </button>
            ))}
          {!categories.some((c) => c.id !== 'uncategorized' && !c.hidden) && (
            <p>Create your first category to start reviewing.</p>
          )}
        </div>
        <details>
          <summary>Create a category</summary>
          <form
            className="finance-actions"
            onSubmit={async (e) => {
              e.preventDefault()
              const id = await onCreateCategory(
                categoryName,
                t.amount > 0 ? 'income' : 'expense',
              )
              if (id) {
                setCategory(id)
                setCategoryName('')
              }
            }}
          >
            <input
              aria-label="New category name"
              placeholder="Category name"
              required
              maxLength={200}
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
            />
            <button disabled={busy || !categoryName.trim()}>
              Create category
            </button>
          </form>
        </details>
        {detail?.insight ? (
          <div className="finance-insight">
            <small>AI merchant description</small>
            <p>
              {detail.insight.description ??
                'Merchant not confidently identified.'}
            </p>
          </div>
        ) : (
          <button className="finance-link" disabled={busy} onClick={onDescribe}>
            Identify merchant with AI
          </button>
        )}
        {insightError && (
          <p className="finance-muted" role="status">
            {insightError}
          </p>
        )}
        <label>
          Personal notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={10000}
          />
        </label>
        <label className="finance-check">
          <input
            type="checkbox"
            checked={createRule}
            onChange={(e) => setCreateRule(e.target.checked)}
          />
          Automatically categorise future transactions from this merchant
        </label>
        <details>
          <summary>More options</summary>
          <label>
            Tags, separated by commas
            <input value={tags} onChange={(e) => setTags(e.target.value)} />
          </label>
          <label className="finance-check">
            <input
              type="checkbox"
              checked={excluded}
              onChange={(e) => setExcluded(e.target.checked)}
            />
            Exclude from income and expense totals
          </label>
          <details>
            <summary>Split transaction</summary>
            <p>Signed split amounts must add up to {money(t.amount)}.</p>
            {splits.map((s, i) => (
              <div className="finance-actions" key={i}>
                <select
                  aria-label={`Split ${i + 1} category`}
                  value={s.category}
                  onChange={(e) =>
                    setSplits((list) =>
                      list.map((row, n) =>
                        n === i ? { ...row, category: e.target.value } : row,
                      ),
                    )
                  }
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Split ${i + 1} amount`}
                  type="number"
                  step="0.01"
                  defaultValue={s.amount / 100}
                  onBlur={(e) => {
                    try {
                      const amount = minorUnits(e.target.value)
                      setSplits((list) =>
                        list.map((row, n) =>
                          n === i ? { ...row, amount } : row,
                        ),
                      )
                      setSplitError('')
                    } catch {
                      setSplitError(
                        'Enter an amount with up to two decimal places',
                      )
                    }
                  }}
                />
              </div>
            ))}
            <button
              onClick={() => setSplits([...splits, { category, amount: 0 }])}
            >
              Add split
            </button>
            <button onClick={() => setSplits([])}>Clear splits</button>
            {splitError && <p role="alert">{splitError}</p>}
          </details>
          <details>
            <summary>Match a transfer or refund</summary>
            <p>
              Copy the other record ID from its details. Confirmed transfers
              must have equal opposite amounts in different accounts. For
              refunds, open the original debit first.
            </p>
            <input
              aria-label="Matching transaction ID"
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
            />
            <button
              disabled={busy || !matchId}
              onClick={() => onMatch(matchId, 'transfer')}
            >
              Confirm internal transfer
            </button>
            <button
              disabled={busy || !matchId}
              onClick={() => onMatch(matchId, 'refund')}
            >
              Confirm refund
            </button>
            <p>
              Transfer: {t.transferId ?? 'None'} · Refund:{' '}
              {t.refundId ?? 'None'}
            </p>
          </details>
        </details>
        <details>
          <summary>Receipts & documents</summary>
          <label>
            Attach PNG, JPEG, WebP or PDF (up to 1 MB)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onUpload(file)
                e.target.value = ''
              }}
            />
          </label>
          {detail?.attachments.map((a) => (
            <p key={a.id}>
              <a
                href={`/api/finance/receipts/${encodeURIComponent(a.id)}`}
                download
              >
                {a.name}
              </a>
            </p>
          ))}
        </details>
        <details>
          <summary>Review history</summary>
          {detail?.audit.map((a, i) => (
            <p key={i}>{financeTime(a.changed_at)} · Bookkeeping updated</p>
          ))}
        </details>
        <details>
          <summary>Original bank information</summary>
          <dl>
            <dt>Record ID</dt>
            <dd>{t.id}</dd>
            <dt>Bank ID</dt>
            <dd>{t.providerId ?? 'Pending: no stable bank ID'}</dd>
            <dt>Description</dt>
            <dd>{t.description}</dd>
            <dt>Bank type</dt>
            <dd>{t.type}</dd>
            <dt>Detected</dt>
            <dd>{financeTime(t.importedAt)}</dd>
            <dt>Last observed</dt>
            <dd>{financeTime(t.observedAt)}</dd>
            <dt>Bank updated</dt>
            <dd>{financeTime(t.providerUpdatedAt)}</dd>
            <dt>Bank-reported running balance</dt>
            <dd>{money(t.balance, t.currency)}</dd>
            <dt>Provider category</dt>
            <dd>{t.providerCategory ?? 'Not supplied'}</dd>
            <dt>Rule</dt>
            <dd>{t.ruleId ?? 'None'}</dd>
          </dl>
        </details>
        <div className="finance-actions finance-review-save">
          <button
            className="finance-primary"
            disabled={busy || !!splitError || category === 'uncategorized'}
            onClick={() => save('reviewed', true)}
          >
            {busy ? 'Saving...' : 'Save & next'}
          </button>
          <button
            disabled={busy || !!splitError}
            onClick={() => save('reviewed', false)}
          >
            Save & close
          </button>
        </div>
      </div>
    </Modal>
  )
}

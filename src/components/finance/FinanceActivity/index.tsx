import { ArrowDownLeft, ArrowUpRight, ChevronRight } from 'lucide-react'
import type {
  FinanceData,
  FinanceTransaction,
} from '../../../shared/types/finance'
import { financeTime, money } from '../../../shared/utils/finance'

export default function FinanceActivity({
  data,
  items,
  onOpen,
  selected,
  onSelect,
}: {
  data: FinanceData
  items: FinanceTransaction[]
  onOpen: (id: string) => void
  selected?: string[]
  onSelect?: (id: string, checked: boolean) => void
}) {
  const accounts = new Map(data.accounts.map((a) => [a.id, a.name]))
  const categories = new Map(data.categories.map((c) => [c.id, c.name]))
  return (
    <div className="finance-activity">
      <div className="finance-activity-heading" aria-hidden="true">
        <span>Transaction</span>
        <span>Category</span>
        <span>Amount</span>
        <span />
      </div>
      {items.map((t) => (
        <div className="finance-activity-line" key={t.id}>
          {onSelect && (
            <label className="finance-row-select">
              <input
                type="checkbox"
                aria-label={`Select ${t.merchant}`}
                checked={selected?.includes(t.id) ?? false}
                onChange={(e) => onSelect(t.id, e.target.checked)}
              />
            </label>
          )}
          <button className="finance-activity-row" onClick={() => onOpen(t.id)}>
            <span className="finance-merchant">
              <span
                className={`finance-merchant-icon ${t.amount > 0 ? 'finance-income' : ''}`}
                aria-hidden="true"
              >
                {t.amount > 0 ? (
                  <ArrowDownLeft size={18} />
                ) : (
                  <ArrowUpRight size={18} />
                )}
              </span>
              <span>
                <strong>{t.merchant}</strong>
                <small>
                  {financeTime(t.date)} ·{' '}
                  {accounts.get(t.accountId) ?? 'Account'}
                </small>
              </span>
            </span>
            <span className="finance-activity-category">
              {categories.get(t.category) ?? 'Uncategorised'}
              <small>
                {t.review.replaceAll('-', ' ')}
                {t.ruleId ? ' · Rule categorised' : ''}
                {t.tags.length ? ` · ${t.tags.join(', ')}` : ''}
              </small>
            </span>
            <span className="finance-activity-amount">
              <strong className={t.amount > 0 ? 'finance-income' : ''}>
                {t.amount > 0 ? '+' : ''}
                {money(t.amount, t.currency)}
              </strong>
              <small>{t.status}</small>
            </span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  )
}

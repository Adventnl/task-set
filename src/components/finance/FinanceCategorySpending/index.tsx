import type {
  FinanceCategory,
  FinanceMetrics,
} from '../../../shared/types/finance'
import { money } from '../../../shared/utils/finance'

export default function FinanceCategorySpending({
  categories,
  values,
  onCategory,
  limit,
}: {
  categories: FinanceCategory[]
  values: FinanceMetrics['categories']
  onCategory: (id: string) => void
  limit?: number
}) {
  const positive = values.filter((c) => c.amount > 0)
  const total = Math.max(
    1,
    positive.reduce((sum, c) => sum + c.amount, 0),
  )
  const names = new Map(categories.map((c) => [c.id, c.name]))
  return (
    <>
      {!values.length && (
        <div className="finance-panel-empty">
          <strong>No category spending yet</strong>
          <p>
            Categories will show where your money goes once spending is
            imported.
          </p>
        </div>
      )}
      {values.slice(0, limit).map((c) => (
        <button
          className="finance-category-row"
          key={c.id}
          onClick={() => onCategory(c.id)}
        >
          <span>
            {names.get(c.id) ?? c.id}
            <strong>{money(c.amount)}</strong>
          </span>
          <meter
            aria-label={`${names.get(c.id) ?? c.id} spending`}
            min="0"
            max={total}
            value={Math.max(0, c.amount)}
          />
        </button>
      ))}
    </>
  )
}

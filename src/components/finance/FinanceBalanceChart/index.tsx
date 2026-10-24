import type { FinanceBalance } from '../../../shared/types/finance'
import { financeTime, money } from '../../../shared/utils/finance'
export default function FinanceBalanceChart({
  balances,
}: {
  balances: FinanceBalance[]
}) {
  const points = balances
    .filter((b) => b.current !== null)
    .sort((a, b) =>
      (a.reportedAt ?? a.observedAt).localeCompare(
        b.reportedAt ?? b.observedAt,
      ),
    )
  if (!points.length) return <p>No balance observations yet.</p>
  const values = points.map((b) => b.current!),
    min = Math.min(...values),
    max = Math.max(...values),
    dates = points.map((b) => Date.parse(b.reportedAt ?? b.observedAt)),
    first = dates[0],
    last = dates.at(-1)!
  return (
    <figure>
      <svg
        viewBox="0 0 600 180"
        role="img"
        aria-label="Bank balance observations. Points represent observations only; gaps are not reconstructed."
        style={{ width: '100%', color: 'var(--accent)' }}
      >
        {points.map((b, i) => (
          <circle
            key={i}
            cx={20 + ((dates[i] - first) / Math.max(1, last - first)) * 560}
            cy={160 - ((b.current! - min) / Math.max(1, max - min)) * 140}
            r="4"
            fill="currentColor"
          >
            <title>
              {financeTime(b.reportedAt)} · {money(b.current, b.currency)} ·
              observed {financeTime(b.observedAt)}
            </title>
          </circle>
        ))}
      </svg>
      <figcaption>
        Observed low {money(min, points[0].currency)} · high{' '}
        {money(max, points[0].currency)} · net change{' '}
        {money(
          points.at(-1)!.current! - points[0].current!,
          points[0].currency,
        )}
        . Points are observations; no exact balances are inferred between them.
      </figcaption>
    </figure>
  )
}

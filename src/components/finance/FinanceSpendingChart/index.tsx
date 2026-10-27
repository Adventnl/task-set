import type { FinanceMetrics } from '../../../shared/types/finance'
import { money } from '../../../shared/utils/finance'
import { spendingPlot } from '../../../shared/utils/financeDashboard'

export default function FinanceSpendingChart({
  metrics,
  onDay,
}: {
  metrics: FinanceMetrics | null
  onDay?: (date: string) => void
}) {
  const { points, max, zeroY } = spendingPlot(metrics?.daily ?? [])
  const line = points.map((p) => `${p.x},${p.y}`).join(' ')
  return (
    <div className="finance-spending-chart">
      {!points.length ? (
        <div className="finance-chart-empty">
          <strong>No spending recorded in this period</strong>
          <p>
            Imported spending will appear here. Try a wider date range if you
            have older history.
          </p>
        </div>
      ) : (
        <>
          <svg
            viewBox="0 0 640 230"
            role="img"
            aria-label="Recorded daily spending in NZD. Values may be negative when matched refunds exceed spending. Imported history may be incomplete."
          >
            {[28, 104, 180].map((y) => (
              <line
                key={y}
                x1="24"
                x2="616"
                y1={y}
                y2={y}
                className="finance-chart-grid"
              />
            ))}
            <text x="24" y="20" className="finance-chart-label">
              {money(max)}
            </text>
            <text
              x="616"
              y={zeroY - 4}
              textAnchor="end"
              className="finance-chart-label"
            >
              $0
            </text>
            <polygon
              points={`${points[0].x},${zeroY} ${line} ${points.at(-1)!.x},${zeroY}`}
              className="finance-chart-area"
            />
            <polyline points={line} className="finance-chart-line" />
            {points.map((p) => (
              <circle
                key={p.id}
                cx={p.x}
                cy={p.y}
                r="3"
                className="finance-chart-point"
              >
                <title>
                  {p.id}: {money(p.amount)}
                </title>
              </circle>
            ))}
            <text x="24" y="220" className="finance-chart-label">
              {points[0].id}
            </text>
            {points.length > 1 && (
              <text
                x="616"
                y="220"
                textAnchor="end"
                className="finance-chart-label"
              >
                {points.at(-1)!.id}
              </text>
            )}
          </svg>
          <details className="finance-chart-data">
            <summary>View daily amounts</summary>
            {points.map((p) =>
              onDay ? (
                <button
                  className="finance-chart-day"
                  key={p.id}
                  onClick={() => onDay(p.id)}
                >
                  {p.id} <strong>{money(p.amount)}</strong>
                </button>
              ) : (
                <p key={p.id}>
                  {p.id} <strong>{money(p.amount)}</strong>
                </p>
              ),
            )}
          </details>
        </>
      )}
    </div>
  )
}

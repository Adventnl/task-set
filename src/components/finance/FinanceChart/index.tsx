import { useState } from 'react'
import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { money } from '../../../shared/utils/finance'

export interface FinanceChartPoint {
  id: string
  time: number
  amount: number
}
const dateLabel = (time: number) =>
  new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    day: 'numeric',
    month: 'short',
  }).format(time)
export default function FinanceChart({
  points,
  currency = 'NZD',
  label,
  onSelect,
}: {
  points: FinanceChartPoint[]
  currency?: string
  label: string
  onSelect?: (id: string) => void
}) {
  const [reset, setReset] = useState(0)
  if (!points.length)
    return <p className="finance-chart-empty">No records in this period.</p>
  return (
    <div className="finance-interactive-chart" aria-label={label}>
      <div className="finance-chart-tools">
        <span>Hover or tap for values · Drag the handles to zoom</span>
        <button onClick={() => setReset((value) => value + 1)}>
          Reset zoom
        </button>
      </div>
      <div className="finance-chart-canvas">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart
            key={reset}
            data={points}
            accessibilityLayer
            margin={{ top: 12, right: 12, bottom: 8, left: 0 }}
            onClick={(state, event) => {
              if (
                event.target instanceof Element &&
                event.target.closest('.recharts-brush')
              )
                return
              const point = points.find(
                (p) => p.time === Number(state.activeLabel),
              )
              if (point && onSelect) onSelect(point.id)
            }}
          >
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="time"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={dateLabel}
              minTickGap={35}
              stroke="var(--text-muted)"
              tick={{ fontSize: 11 }}
            />
            <YAxis
              width={70}
              tickFormatter={(value: number) => money(value, currency)}
              stroke="var(--text-muted)"
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              labelFormatter={(value) => dateLabel(Number(value))}
              formatter={(value) => [money(Number(value), currency), 'Amount']}
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--line-strong)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text)',
              }}
              itemStyle={{ color: 'var(--text)' }}
            />
            <Line
              type="linear"
              dataKey="amount"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={{ r: 3, fill: 'var(--surface)' }}
              activeDot={{ r: 7 }}
              isAnimationActive={false}
            />
            {points.length > 1 && (
              <Brush
                ariaLabel="Chart date range. Use left and right arrow keys to adjust."
                dataKey="time"
                height={32}
                travellerWidth={12}
                tickFormatter={dateLabel}
                stroke="var(--accent)"
                fill="var(--surface)"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="finance-chart-data">
        <summary>View values{onSelect ? ' and open transactions' : ''}</summary>
        {points.map((p) =>
          onSelect ? (
            <button
              className="finance-chart-day"
              key={p.id}
              onClick={() => onSelect(p.id)}
            >
              {dateLabel(p.time)} <strong>{money(p.amount, currency)}</strong>
            </button>
          ) : (
            <p key={p.id}>
              {new Date(p.time).toLocaleString('en-NZ', {
                timeZone: 'Pacific/Auckland',
              })}{' '}
              · {money(p.amount, currency)}
            </p>
          ),
        )}
      </details>
    </div>
  )
}

import type { FinanceFilter } from '../../../shared/types/finance'
import { useState } from 'react'
import {
  financePeriod,
  type FinancePeriod as Period,
} from '../../../shared/utils/financeDashboard'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '60', label: 'Last 60 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 180 days' },
  { value: '365', label: 'Last 365 days' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All history' },
]
export default function FinancePeriod({
  filter,
  onFilter,
}: {
  filter: FinanceFilter
  onFilter: (patch: Partial<FinanceFilter>) => void
}) {
  const [editingDates, setEditingDates] = useState(false)
  const selected =
    PERIODS.find(({ value }) => {
      const range = financePeriod(value)
      return range.start === filter.start && range.end === filter.end
    })?.value ?? 'custom'
  return (
    <div className="finance-period">
      <label>
        <span className="sr-only">Date range</span>
        <select
          value={editingDates ? 'custom' : selected}
          onChange={(e) => {
            setEditingDates(e.target.value === 'custom')
            if (e.target.value !== 'custom')
              onFilter(financePeriod(e.target.value as Period))
          }}
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
          <option value="custom">Custom dates</option>
        </select>
      </label>
      {(editingDates || selected === 'custom') && (
        <div className="finance-custom-dates">
          <label>
            <span className="sr-only">From date</span>
            <input
              type="date"
              value={filter.start}
              max={filter.end || undefined}
              onChange={(e) => onFilter({ start: e.target.value })}
            />
          </label>
          <span aria-hidden="true">–</span>
          <label>
            <span className="sr-only">To date</span>
            <input
              type="date"
              value={filter.end}
              min={filter.start || undefined}
              onChange={(e) => onFilter({ end: e.target.value })}
            />
          </label>
        </div>
      )}
    </div>
  )
}

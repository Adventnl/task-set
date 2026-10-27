import type { FinanceMetrics } from '../../../shared/types/finance'
import FinanceChart from '../FinanceChart'
export default function FinanceSpendingChart({
  metrics,
  onDay,
}: {
  metrics: FinanceMetrics | null
  onDay?: (date: string) => void
}) {
  const points = [...(metrics?.daily ?? [])]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((p) => ({ ...p, time: Date.parse(p.id + 'T00:00:00Z') }))
  return (
    <FinanceChart
      points={points}
      label="Recorded daily spending in NZD"
      onSelect={onDay}
    />
  )
}

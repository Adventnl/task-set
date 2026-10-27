import type { FinanceBalance } from '../../../shared/types/finance'
import FinanceChart from '../FinanceChart'
export default function FinanceBalanceChart({
  balances,
}: {
  balances: FinanceBalance[]
}) {
  const points = balances
    .filter((b) => b.current !== null)
    .map((b) => ({
      id: b.observedAt,
      time: Date.parse(b.reportedAt ?? b.observedAt),
      amount: b.current!,
    }))
    .sort((a, b) => a.time - b.time)
  return (
    <FinanceChart
      points={points}
      currency={balances[0]?.currency}
      label="Observed bank balances. Gaps are not reconstructed."
    />
  )
}

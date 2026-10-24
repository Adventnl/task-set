import type { FinanceTransaction } from '../../src/shared/types/finance'
import type { RecurringPayment } from '../../src/shared/types/finance'
/** Candidates require consistent amounts and intervals. Repeated shopping alone is insufficient. */
export function recurringCandidates(
  transactions: FinanceTransaction[],
): RecurringPayment[] {
  const groups = new Map<string, FinanceTransaction[]>()
  for (const tx of transactions) {
    if (
      tx.currency !== 'NZD' ||
      tx.status !== 'settled' ||
      tx.transferId ||
      tx.excluded ||
      tx.refundId
    )
      continue
    const key = `${tx.accountId}:${Math.sign(tx.amount)}:${tx.merchant.toLowerCase()}`
    groups.set(key, [...(groups.get(key) ?? []), tx])
  }
  const result: RecurringPayment[] = []
  for (const [id, items] of groups) {
    const sorted = items.sort((a, b) => a.date.localeCompare(b.date))
    if (sorted.length < 3) continue
    const recent = sorted.slice(-6),
      amounts = recent.map((t) => Math.abs(t.amount)).sort((a, b) => a - b),
      typical = amounts[Math.floor(amounts.length / 2)]
    if (
      !typical ||
      amounts.some((v) => Math.abs(v - typical) > Math.max(100, typical * 0.05))
    )
      continue
    const intervals = recent
      .slice(1)
      .map(
        (t, i) => (Date.parse(t.date) - Date.parse(recent[i].date)) / 86400000,
      )
    const frequency = [
      { name: 'weekly' as const, days: 7, tolerance: 2, yearly: 52 },
      { name: 'fortnightly' as const, days: 14, tolerance: 3, yearly: 26 },
      { name: 'monthly' as const, days: 30.4375, tolerance: 4, yearly: 12 },
      { name: 'annual' as const, days: 365.25, tolerance: 7, yearly: 1 },
    ].find((f) => intervals.every((v) => Math.abs(v - f.days) <= f.tolerance))
    if (!frequency) continue
    const last = recent.at(-1)!,
      annualEquivalent = typical * frequency.yearly * Math.sign(last.amount)
    result.push({
      id,
      merchant: last.merchant,
      amount: typical * Math.sign(last.amount),
      frequency: frequency.name,
      lastPayment: last.date,
      estimatedNext: new Date(
        Date.parse(last.date) + frequency.days * 86400000,
      ).toISOString(),
      monthlyEquivalent: Math.round(annualEquivalent / 12),
      annualEquivalent,
      confirmed: false,
      active: true,
      notes: '',
    })
  }
  return result
}

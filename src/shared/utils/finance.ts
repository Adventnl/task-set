import type {
  FinanceEdit,
  FinanceRule,
  FinanceTransaction,
} from '../types/finance'

/** Convert decimal bank amounts to integer cents before any aggregation. Reject excess precision. */
export function minorUnits(value: unknown): number {
  if (typeof value !== 'number' && typeof value !== 'string')
    throw new Error('Invalid monetary value')
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(value))
  if (!match) throw new Error('Invalid monetary precision')
  const result =
    Number(match[2]) * 100 + Number((match[3] ?? '').padEnd(2, '0'))
  if (!Number.isSafeInteger(result)) throw new Error('Amount out of range')
  return match[1] ? -result : result
}
export function money(value: number | null, currency = 'NZD'): string {
  return value === null
    ? 'Not supplied'
    : new Intl.NumberFormat('en-NZ', { style: 'currency', currency }).format(
        value / 100,
      )
}
export function nzDay(value: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}
export function financeTime(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat('en-NZ', {
        timeZone: 'Pacific/Auckland',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : 'Not yet observed'
}
export function ruleFor(
  tx: Pick<
    FinanceTransaction,
    'merchant' | 'description' | 'accountId' | 'amount'
  >,
  rules: FinanceRule[],
): FinanceRule | undefined {
  return [...rules]
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .find((rule) => {
      if (!rule.enabled || (rule.accountId && rule.accountId !== tx.accountId))
        return false
      if (
        (rule.direction === 'debit' && tx.amount >= 0) ||
        (rule.direction === 'credit' && tx.amount <= 0)
      )
        return false
      const merchant = tx.merchant.toLocaleLowerCase(),
        term = rule.text.toLocaleLowerCase()
      return rule.match === 'exact'
        ? merchant === term
        : `${merchant} ${tx.description.toLocaleLowerCase()}`.includes(term)
    })
}
export function validSplits(
  amount: number,
  splits: FinanceEdit['splits'],
): boolean {
  return (
    splits.length === 0 ||
    (splits.length >= 2 &&
      splits.every(
        (s) =>
          Number.isSafeInteger(s.amount) &&
          Math.sign(s.amount) === Math.sign(amount),
      ) &&
      splits.reduce((sum, s) => sum + s.amount, 0) === amount)
  )
}
/** Settled cash movements only. Transfers/exclusions never enter consolidated totals. */
export function totals(transactions: FinanceTransaction[]): {
  income: number
  expenses: number
  net: number
} {
  let income = 0,
    expenses = 0
  for (const tx of transactions) {
    if (
      tx.currency !== 'NZD' ||
      tx.status !== 'settled' ||
      tx.excluded ||
      tx.transferId
    )
      continue
    if (tx.amount > 0 && !tx.refundId) income += tx.amount
    else expenses -= tx.amount
  }
  if (![income, expenses].every(Number.isSafeInteger))
    throw new Error('Total out of range')
  return { income, expenses, net: income - expenses }
}
/** Escape formula-leading text, including whitespace-prefixed spreadsheet formulas. */
export function csvCell(value: unknown): string {
  const text = String(value ?? '')
  return `"${(/^[\s]*[=+@-]/.test(text) ? "'" : '') + text.replaceAll('"', '""')}"`
}

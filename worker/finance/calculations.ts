import type {
  FinanceBudget,
  FinanceMetrics,
  FinanceTransaction,
} from '../../src/shared/types/finance'
import { nzDay, totals } from '../../src/shared/utils/finance'

/** Budget boundaries are local calendar dates, independent of daylight-saving transitions. */
export function budgetPeriod(
  b: FinanceBudget,
  today: string,
): { start: string; end: string } {
  const anchor = new Date(b.start + 'T00:00:00Z'),
    now = new Date(today + 'T00:00:00Z')
  if (b.period === 'weekly') {
    const elapsed = Math.max(
      0,
      Math.floor((now.getTime() - anchor.getTime()) / (7 * 86400000)),
    )
    const start = new Date(anchor.getTime() + elapsed * 7 * 86400000),
      end = new Date(start.getTime() + 6 * 86400000)
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    }
  }
  const day = anchor.getUTCDate()
  const date = (year: number, month: number) =>
    new Date(
      Date.UTC(
        year,
        month,
        Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate()),
      ),
    )
  let start = date(now.getUTCFullYear(), now.getUTCMonth())
  if (start > now) start = date(now.getUTCFullYear(), now.getUTCMonth() - 1)
  if (start < anchor) start = anchor
  const next = date(start.getUTCFullYear(), start.getUTCMonth() + 1)
  return {
    start: start.toISOString().slice(0, 10),
    end: new Date(next.getTime() - 86400000).toISOString().slice(0, 10),
  }
}
export function calculateMetrics(
  items: FinanceTransaction[],
  all: FinanceTransaction[],
  budgets: FinanceBudget[],
  today: string,
): FinanceMetrics {
  const settled = items.filter(
    (t) =>
      t.currency === 'NZD' &&
      t.status === 'settled' &&
      !t.excluded &&
      !t.transferId,
  )
  const categories = new Map<string, number>(),
    months = new Map<string, { income: number; expenses: number }>(),
    merchants = new Map<string, { amount: number; count: number }>(),
    daily = new Map<string, number>()
  for (const t of settled) {
    const day = nzDay(t.date),
      month = day.slice(0, 7),
      expense = t.amount < 0 || t.refundId ? -t.amount : 0
    const previous = months.get(month) ?? { income: 0, expenses: 0 },
      summary = totals([t])
    months.set(month, {
      income: previous.income + summary.income,
      expenses: previous.expenses + summary.expenses,
    })
    if (expense) {
      for (const split of t.splits.length
        ? t.splits
        : [{ category: t.category, amount: t.amount }])
        categories.set(
          split.category,
          (categories.get(split.category) ?? 0) - split.amount,
        )
      const merchant = merchants.get(t.merchant) ?? { amount: 0, count: 0 }
      merchants.set(t.merchant, {
        amount: merchant.amount + expense,
        count: merchant.count + 1,
      })
      daily.set(day, (daily.get(day) ?? 0) + expense)
    }
  }
  const review = all.filter(
    (t) =>
      t.review !== 'reviewed' &&
      t.review !== 'ignored' &&
      t.status !== 'missing-pending',
  )
  const currentMonth = today.slice(0, 7),
    previousMonth = new Date(
      Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1),
    )
      .toISOString()
      .slice(0, 7)
  const detected = totals(all.filter((t) => nzDay(t.importedAt) === today)),
    monthly = totals(all.filter((t) => nzDay(t.date).startsWith(currentMonth))),
    previous = totals(
      all.filter((t) => nzDay(t.date).startsWith(previousMonth)),
    )
  const sizes = settled
      .filter((t) => t.amount < 0)
      .map((t) => -t.amount)
      .sort((a, b) => a - b),
    middle = Math.floor(sizes.length / 2),
    median = sizes.length
      ? sizes.length % 2
        ? sizes[middle]
        : Math.round((sizes[middle - 1] + sizes[middle]) / 2)
      : null
  return {
    todayIncome: detected.income,
    todaySpending: detected.expenses,
    monthIncome: monthly.income,
    monthExpenses: monthly.expenses,
    previousExpenses: previous.expenses,
    median,
    ...totals(items),
    count: items.length,
    reviewCount: review.length,
    reviewIncome: review
      .filter((t) => t.amount > 0 && t.currency === 'NZD')
      .reduce((s, t) => s + t.amount, 0),
    reviewExpenses: -review
      .filter((t) => t.amount < 0 && t.currency === 'NZD')
      .reduce((s, t) => s + t.amount, 0),
    categories: [...categories]
      .map(([id, amount]) => ({ id, amount }))
      .sort((a, b) => b.amount - a.amount),
    months: [...months]
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    merchants: [...merchants]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.amount - a.amount),
    daily: [...daily]
      .map(([id, amount]) => ({ id, amount }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    budgetUsage: budgets
      .filter((b) => !b.archived)
      .map((b) => {
        const period = budgetPeriod(b, today)
        const transactions = all.filter(
          (t) =>
            t.currency === 'NZD' &&
            t.status === 'settled' &&
            !t.excluded &&
            !t.transferId &&
            nzDay(t.date) >= period.start &&
            nzDay(t.date) <= period.end &&
            (t.amount < 0 || t.refundId),
        )
        const spent = transactions.reduce(
          (sum, t) =>
            sum +
            (t.splits.length
              ? t.splits
                  .filter((s) => !b.category || s.category === b.category)
                  .reduce((n, s) => n - s.amount, 0)
              : !b.category || t.category === b.category
                ? -t.amount
                : 0),
          0,
        )
        return { id: b.id, spent, ...period }
      }),
  }
}

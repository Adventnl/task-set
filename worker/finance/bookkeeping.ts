import type {
  FinanceTransaction,
  FinanceEdit,
  FinanceCategory,
  FinanceRule,
  FinanceBudget,
} from '../../src/shared/types/finance'
import { validSplits } from '../../src/shared/utils/finance'
import { FinanceRepository } from './repository'
type BodyRow = { body: string }
/** Local annotations, confirmed matching and their audit history never write bank source facts. */
export class FinanceBookkeeping extends FinanceRepository {
  private allTransactions(): FinanceTransaction[] {
    return this.list<FinanceTransaction>('transactions').map((t) =>
      this.annotated(t),
    )
  }
  private annotated(tx: FinanceTransaction): FinanceTransaction {
    const row = this.sql
      .exec<BodyRow>(
        'SELECT body FROM finance_bookkeeping WHERE transaction_id = ?',
        tx.id,
      )
      .toArray()[0]
    return row ? { ...tx, ...(JSON.parse(row.body) as FinanceEdit) } : tx
  }
  transaction(id: string): FinanceTransaction | null {
    const t = this.read<FinanceTransaction>('transactions', id)
    return t ? this.annotated(t) : null
  }
  audit(id: string): unknown[] {
    return this.sql
      .exec(
        'SELECT changed_at, before_body, after_body FROM finance_audit WHERE transaction_id = ? ORDER BY changed_at DESC',
        id,
      )
      .toArray()
  }
  edit(id: string, input: FinanceEdit): void {
    const tx = this.transaction(id)
    if (!tx) throw new Error('Transaction not found')
    if (
      !this.read('categories', input.category) ||
      !validSplits(tx.amount, input.splits) ||
      input.splits.some((s) => !this.read('categories', s.category))
    )
      throw new Error('Invalid category or split total')
    if (input.transferId || input.refundId)
      throw new Error('Use the confirmed matching action to link transactions')
    const now = new Date().toISOString()
    const edit = {
      ...input,
      transferId: tx.transferId,
      refundId: tx.refundId,
      reviewedAt: input.review === 'reviewed' ? now : null,
    }
    this.storage.transactionSync(() => {
      this.sql.exec(
        'INSERT OR REPLACE INTO finance_bookkeeping(transaction_id, body) VALUES (?, ?)',
        id,
        JSON.stringify(edit),
      )
      this.sql.exec(
        'INSERT INTO finance_audit VALUES (?, ?, ?, ?, ?)',
        crypto.randomUUID(),
        id,
        now,
        JSON.stringify(tx),
        JSON.stringify(edit),
      )
      if (input.createRule) {
        const direction = tx.amount < 0 ? 'debit' : 'credit'
        const existing = this.list<FinanceRule>('rules').find(
          (r) =>
            r.match === 'exact' &&
            r.text === tx.merchant &&
            r.accountId === null &&
            r.direction === direction,
        )
        const ruleId = existing?.id ?? crypto.randomUUID()
        this.put('rules', ruleId, {
          id: ruleId,
          text: tx.merchant,
          match: 'exact',
          category: input.category,
          priority: 100,
          enabled: true,
          accountId: null,
          direction,
        })
      }
    })
  }
  match(first: string, second: string, kind: 'transfer' | 'refund'): void {
    const a = this.transaction(first),
      b = this.transaction(second)
    if (
      !a ||
      !b ||
      a.id === b.id ||
      a.currency !== b.currency ||
      a.status !== 'settled' ||
      b.status !== 'settled' ||
      a.transferId ||
      b.transferId ||
      b.refundId ||
      (kind === 'transfer' && a.refundId)
    )
      throw new Error('Transactions cannot be matched')
    if (
      (kind === 'transfer' &&
        (a.accountId === b.accountId || a.amount !== -b.amount)) ||
      (kind === 'refund' &&
        (a.amount >= 0 || b.amount <= 0 || b.amount > -a.amount))
    )
      throw new Error('Amounts do not match')
    if (kind === 'refund') {
      const refunded = this.allTransactions()
        .filter((t) => t.refundId === a.id && t.amount > 0)
        .reduce((n, t) => n + t.amount, 0)
      if (refunded + b.amount > -a.amount)
        throw new Error('Refunds exceed the original purchase')
    }
    this.storage.transactionSync(() => {
      for (const [tx, other] of [
        [a, b],
        [b, a],
      ]) {
        const updated = {
          ...tx,
          category:
            kind === 'refund' &&
            tx.id === b.id &&
            tx.category === 'uncategorized' &&
            !a.splits.length
              ? a.category
              : tx.category,
          [kind === 'transfer' ? 'transferId' : 'refundId']:
            kind === 'refund' && tx.id === a.id && tx.refundId
              ? tx.refundId
              : other.id,
        }
        this.sql.exec(
          'INSERT OR REPLACE INTO finance_bookkeeping VALUES (?, ?)',
          tx.id,
          JSON.stringify({
            category: updated.category,
            notes: updated.notes,
            tags: updated.tags,
            review: updated.review,
            reviewedAt: updated.reviewedAt,
            excluded: updated.excluded,
            transferId: updated.transferId,
            refundId: updated.refundId,
            splits: updated.splits,
          }),
        )
        this.sql.exec(
          'INSERT INTO finance_audit VALUES (?, ?, ?, ?, ?)',
          crypto.randomUUID(),
          tx.id,
          new Date().toISOString(),
          JSON.stringify(tx),
          JSON.stringify(updated),
        )
      }
    })
  }
  saveCategory(c: FinanceCategory): void {
    if (!c.id || c.id === 'uncategorized' || !c.name.trim())
      throw new Error('Enter a category name')
    if (
      this.list<FinanceCategory>('categories').some(
        (existing) =>
          existing.id !== c.id &&
          existing.name.toLocaleLowerCase() ===
            c.name.trim().toLocaleLowerCase(),
      )
    )
      throw new Error('A category with this name already exists')
    const seen = new Set([c.id])
    let parent = c.parentId
    while (parent) {
      if (seen.has(parent))
        throw new Error('Category hierarchy cannot contain a cycle')
      seen.add(parent)
      const record = this.read<FinanceCategory>('categories', parent)
      if (!record) throw new Error('Invalid parent category')
      parent = record.parentId
    }
    this.put('categories', c.id, { ...c, name: c.name.trim(), system: false })
  }
  deleteCategory(id: string, replacement: string): void {
    const source = this.read<FinanceCategory>('categories', id)
    if (!source || source.system || id === 'uncategorized')
      throw new Error('This category cannot be deleted')
    if (id === replacement || !this.read('categories', replacement))
      throw new Error('Choose a different replacement category')
    this.storage.transactionSync(() => {
      // Join annotations once; source bank payloads and matching links stay intact.
      const rows = this.sql
        .exec<{
          body: string
          annotation: string | null
        }>(
          'SELECT t.body, b.body AS annotation FROM finance_transactions t LEFT JOIN finance_bookkeeping b ON b.transaction_id = t.id',
        )
        .toArray()
      const now = new Date().toISOString()
      for (const row of rows) {
        const tx = {
          ...JSON.parse(row.body),
          ...(row.annotation ? JSON.parse(row.annotation) : {}),
        } as FinanceTransaction
        if (tx.category !== id && !tx.splits.some((s) => s.category === id))
          continue
        const updated = {
          category: tx.category === id ? replacement : tx.category,
          notes: tx.notes,
          tags: tx.tags,
          review: tx.review,
          reviewedAt: tx.reviewedAt,
          excluded: tx.excluded,
          transferId: tx.transferId,
          refundId: tx.refundId,
          ruleId: tx.ruleId,
          splits: tx.splits.map((s) => ({
            ...s,
            category: s.category === id ? replacement : s.category,
          })),
        }
        this.sql.exec(
          'INSERT OR REPLACE INTO finance_bookkeeping VALUES (?, ?)',
          tx.id,
          JSON.stringify(updated),
        )
        this.sql.exec(
          'INSERT INTO finance_audit VALUES (?, ?, ?, ?, ?)',
          crypto.randomUUID(),
          tx.id,
          now,
          JSON.stringify(tx),
          JSON.stringify(updated),
        )
      }
      for (const rule of this.list<FinanceRule>('rules'))
        if (rule.category === id)
          this.put('rules', rule.id, {
            ...rule,
            category: replacement,
            enabled: replacement === 'uncategorized' ? false : rule.enabled,
          })
      for (const budget of this.list<FinanceBudget>('budgets'))
        if (budget.category === id)
          this.put('budgets', budget.id, {
            ...budget,
            category: replacement,
            archived: replacement === 'uncategorized' ? true : budget.archived,
          })
      for (const child of this.list<FinanceCategory>('categories'))
        if (child.parentId === id)
          this.put('categories', child.id, {
            ...child,
            parentId: source.parentId,
          })
      this.sql.exec('DELETE FROM finance_categories WHERE id = ?', id)
    })
  }
  mergeCategories(from: string, to: string): void {
    const source = this.read<FinanceCategory>('categories', from),
      target = this.read<FinanceCategory>('categories', to)
    if (!source || !target || from === to || source.kind !== target.kind)
      throw new Error('Select two different categories of the same kind')
    const transactions = this.allTransactions()
    for (const tx of transactions)
      if (tx.category === from || tx.splits.some((s) => s.category === from)) {
        const updated = {
          category: tx.category === from ? to : tx.category,
          notes: tx.notes,
          tags: tx.tags,
          review: tx.review,
          reviewedAt: tx.reviewedAt,
          excluded: tx.excluded,
          transferId: tx.transferId,
          refundId: tx.refundId,
          splits: tx.splits.map((s) => ({
            ...s,
            category: s.category === from ? to : s.category,
          })),
        }
        this.sql.exec(
          'INSERT OR REPLACE INTO finance_bookkeeping VALUES (?, ?)',
          tx.id,
          JSON.stringify(updated),
        )
        this.sql.exec(
          'INSERT INTO finance_audit VALUES (?, ?, ?, ?, ?)',
          crypto.randomUUID(),
          tx.id,
          new Date().toISOString(),
          JSON.stringify(tx),
          JSON.stringify(updated),
        )
      }
    for (const r of this.list<FinanceRule>('rules'))
      if (r.category === from) this.put('rules', r.id, { ...r, category: to })
    for (const b of this.list<FinanceBudget>('budgets'))
      if (b.category === from) this.put('budgets', b.id, { ...b, category: to })
    this.put('categories', from, { ...source, hidden: true })
  }
}

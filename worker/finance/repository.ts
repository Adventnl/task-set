import type {
  FinanceSettings,
  FinanceCategory,
  FinanceTransaction,
  FinanceEdit,
  FinanceRule,
  FinanceBudget,
} from '../../src/shared/types/finance'
import type { AkahuEnv } from './akahu'
import { categoryId, DEFAULT_CATEGORIES, FINANCE_SCHEMA } from './schema'
type BodyRow = { body: string }
const DEFAULT_SETTINGS: FinanceSettings = {
  notifications: true,
  push: false,
  privateNotifications: true,
  currency: 'NZD',
  timezone: 'Pacific/Auckland',
}
/** Shared persistence primitives; table names are internal constants, never request input. */
export class FinanceRepository {
  constructor(
    protected storage: DurableObjectStorage,
    protected env: AkahuEnv,
  ) {}
  protected initialize(): void {
    this.storage.sql.exec('PRAGMA foreign_keys = ON;')
    this.storage.sql.exec(FINANCE_SCHEMA)
    this.put(
      'categories',
      'uncategorized',
      {
        id: 'uncategorized',
        name: 'Uncategorised',
        kind: 'special',
        hidden: false,
        color: 'amber',
        parentId: null,
        system: true,
      },
      true,
    )
    // Remove only untouched, unused templates from older versions. Preserve every annotation.
    if (!this.read('settings', 'custom-categories-v1')) {
      const used = new Set<string>(['uncategorized'])
      const records = [
        ...this.list<FinanceTransaction>('transactions'),
        ...this.sql
          .exec<{ body: string }>('SELECT body FROM finance_bookkeeping')
          .toArray()
          .map((r) => JSON.parse(r.body) as FinanceEdit),
      ]
      for (const t of records) {
        used.add(t.category)
        for (const split of t.splits) used.add(split.category)
      }
      for (const r of [
        ...this.list<FinanceRule>('rules'),
        ...this.list<FinanceBudget>('budgets'),
      ])
        if (r.category) used.add(r.category)
      const categories = this.list<FinanceCategory>('categories')
      for (const c of categories) if (c.parentId) used.add(c.parentId)
      for (const [kind, names] of Object.entries(DEFAULT_CATEGORIES))
        for (const name of names) {
          const c = categories.find((v) => v.id === categoryId(name))
          if (
            c &&
            c.system !== false &&
            !used.has(c.id) &&
            c.name === name &&
            c.kind === kind &&
            !c.hidden &&
            !c.parentId &&
            c.color === 'amber'
          )
            this.sql.exec('DELETE FROM finance_categories WHERE id = ?', c.id)
        }
      this.put('settings', 'custom-categories-v1', true)
    }
    const columns = this.sql
      .exec<{ name: string }>('PRAGMA table_info(finance_exports)')
      .toArray()
    if (!columns.some((c) => c.name === 'bytes'))
      this.sql.exec('ALTER TABLE finance_exports ADD COLUMN bytes BLOB')
  }
  protected get sql() {
    return this.storage.sql
  }
  protected list<T>(table: string): T[] {
    return this.sql
      .exec<BodyRow>(`SELECT body FROM finance_${table}`)
      .toArray()
      .map((r) => JSON.parse(r.body) as T)
  }
  protected read<T>(table: string, id: string): T | null {
    const row = this.sql
      .exec<BodyRow>(`SELECT body FROM finance_${table} WHERE id = ?`, id)
      .toArray()[0]
    return row ? (JSON.parse(row.body) as T) : null
  }
  protected put(
    table: string,
    id: string,
    value: unknown,
    ignore = false,
  ): void {
    this.sql.exec(
      `INSERT ${ignore ? 'OR IGNORE' : 'OR REPLACE'} INTO finance_${table} (id, body) VALUES (?, ?)`,
      id,
      JSON.stringify(value),
    )
  }
  settings(): FinanceSettings {
    return this.read('settings', 'preferences') ?? DEFAULT_SETTINGS
  }
}

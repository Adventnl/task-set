import type { FinanceSettings } from '../../src/shared/types/finance'
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
    for (const [kind, names] of Object.entries(DEFAULT_CATEGORIES))
      for (const name of names)
        this.put(
          'categories',
          categoryId(name),
          {
            id: categoryId(name),
            name,
            kind,
            hidden: false,
            color: 'amber',
            parentId: null,
          },
          true,
        )
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

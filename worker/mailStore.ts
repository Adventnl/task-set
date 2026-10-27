import type { MailAccount, MailAccountInput, MailProvider } from '../src/shared/types/mail'
import { MAX_MAIL_ACCOUNTS } from '../src/shared/utils/mail'

type AccountRow = { id: string; provider: MailProvider; address: string; label: string; created_at: string }

export class MailConflict extends Error {}

/** The existing private workspace owns the registry, shared by every signed-in device. */
export class MailStore {
  constructor(private readonly sql: SqlStorage) {
    sql.exec(`CREATE TABLE IF NOT EXISTS mail_accounts (
      id TEXT PRIMARY KEY, provider TEXT NOT NULL, address TEXT NOT NULL UNIQUE COLLATE NOCASE,
      label TEXT NOT NULL, created_at TEXT NOT NULL
    )`)
  }

  accounts(): MailAccount[] {
    return this.sql.exec<AccountRow>('SELECT * FROM mail_accounts ORDER BY created_at, id').toArray().map((row) => ({
      id: row.id, provider: row.provider, address: row.address, label: row.label,
      createdAt: row.created_at, status: 'setup-required',
    }))
  }

  save(id: string, input: MailAccountInput): MailAccount {
    const accounts = this.accounts()
    if (accounts.some((account) => account.id !== id && account.address === input.address)) throw new MailConflict('That email address is already in your account list.')
    if (!accounts.some((account) => account.id === id) && accounts.length >= MAX_MAIL_ACCOUNTS) throw new MailConflict(`You can save up to ${MAX_MAIL_ACCOUNTS} mail accounts.`)
    this.sql.exec(`INSERT INTO mail_accounts (id, provider, address, label, created_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET provider = excluded.provider, address = excluded.address, label = excluded.label`,
    id, input.provider, input.address, input.label, new Date().toISOString())
    return this.accounts().find((account) => account.id === id)!
  }

  remove(id: string): void {
    this.sql.exec('DELETE FROM mail_accounts WHERE id = ?', id)
  }
}

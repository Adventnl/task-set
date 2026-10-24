import type {
  FinanceAccount,
  FinanceBalance,
  FinanceSync,
  FinanceTransaction,
} from '../../src/shared/types/finance'
import { ruleFor } from '../../src/shared/utils/finance'
import {
  AkahuClient,
  AkahuError,
  bankAccount,
  bankTransaction,
  object,
} from './akahu'
import { categoryId } from './schema'
import { FinanceRepository } from './repository'
type BodyRow = { body: string }
/** Owns bank ingestion and refresh state; bookkeeping is written only by the local review service. */
export class FinanceSynchronizer extends FinanceRepository {
  private syncing: Promise<void> | null = null
  get syncActive(): boolean {
    return this.syncing !== null
  }
  sync(): Promise<void> {
    if (this.syncing) return this.syncing
    this.syncing = this.runSync().finally(() => {
      this.syncing = null
    })
    return this.syncing
  }
  private async runSync(): Promise<void> {
    const now = new Date().toISOString(),
      initialized = !!this.read('settings', 'initialized')
    const log: FinanceSync = {
      id: crypto.randomUUID(),
      startedAt: now,
      finishedAt: null,
      status: 'running',
      imported: 0,
      error: null,
    }
    const saveLog = () =>
      this.sql.exec(
        'INSERT OR REPLACE INTO finance_syncs VALUES (?, ?, ?)',
        log.id,
        now,
        JSON.stringify(log),
      )
    saveLog()
    try {
      const api = new AkahuClient(this.env)
      object((await api.request('/me')).item)
      const accounts = (await api.list('/accounts')).map((raw) =>
        bankAccount(raw, now),
      )
      for (const a of accounts) {
        const previous = this.read<FinanceAccount>('accounts', a.id)
        this.put('accounts', a.id, {
          ...a,
          included: previous?.included ?? true,
          archived: previous?.archived ?? false,
        })
        const key = `${a.id}:${a.balanceAt ?? now}:${a.current}:${a.available}`
        this.sql.exec(
          'INSERT OR IGNORE INTO finance_balances VALUES (?, ?, ?, ?)',
          key,
          a.id,
          now,
          JSON.stringify({
            accountId: a.id,
            current: a.current,
            available: a.available,
            currency: a.currency,
            reportedAt: a.balanceAt,
            observedAt: now,
          } satisfies FinanceBalance),
        )
      }
      // Rescan the accessible history so changed bank facts are observed; never delete absent settled records.
      const observed = new Set<string>()
      const start = new Date(Date.parse(now) - 730 * 86400000).toISOString()
      for await (const page of api.transactions(start, now))
        for (const raw of page) {
          const account = accounts.find((a) => a.id === object(raw)._account)
          if (!account) throw new Error('Unknown bank account')
          observed.add(String(object(raw)._id))
          if (
            this.upsert(
              bankTransaction(raw, account, now, false),
              raw,
              initialized,
            )
          )
            log.imported++
        }
      const pending = await api.list('/transactions/pending'),
        seen = new Set<string>(),
        occurrences = new Map<string, number>()
      for (const raw of pending) {
        const account = accounts.find((a) => a.id === object(raw)._account)
        if (!account) throw new Error('Unknown bank account')
        const tx = bankTransaction(raw, account, now, true)
        const signature = JSON.stringify([
          tx.accountId,
          tx.amount,
          tx.date,
          tx.description,
        ])
        const hash = Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              'SHA-256',
              new TextEncoder().encode(signature),
            ),
          ),
        )
          .map((v) => v.toString(16).padStart(2, '0'))
          .join('')
        const index = occurrences.get(hash) ?? 0
        occurrences.set(hash, index + 1)
        tx.id = `pending:${hash}:${index}`
        seen.add(tx.id)
        if (this.upsert(tx, raw, false)) log.imported++
      }
      for (const row of this.sql
        .exec<BodyRow>(
          "SELECT body FROM finance_transactions WHERE status = 'pending'",
        )
        .toArray()) {
        const tx = JSON.parse(row.body) as FinanceTransaction
        if (!seen.has(tx.id)) {
          tx.status = 'missing-pending'
          this.sql.exec(
            'UPDATE finance_transactions SET status = ?, body = ? WHERE id = ?',
            tx.status,
            JSON.stringify(tx),
            tx.id,
          )
        }
      }
      // Absence is a warning, never a deletion or a bank-verified reversal.
      for (const row of this.sql
        .exec<BodyRow>(
          "SELECT body FROM finance_transactions WHERE status = 'settled' AND date >= ? AND date <= ?",
          start,
          now,
        )
        .toArray()) {
        const tx = JSON.parse(row.body) as FinanceTransaction
        if (!observed.has(tx.providerId ?? '') && !tx.upstreamMissingAt)
          this.sql.exec(
            'UPDATE finance_transactions SET body = ? WHERE id = ?',
            JSON.stringify({ ...tx, upstreamMissingAt: now }),
            tx.id,
          )
      }
      this.put('settings', 'initialized', true)
      this.put('settings', 'last-sync', now)
      log.status = 'success'
    } catch (error) {
      log.status = 'failed'
      log.error =
        error instanceof AkahuError
          ? error.message
          : 'Bank synchronisation could not complete. Previously imported history is retained; retry after checking connection and response compatibility.'
      throw new Error(log.error)
    } finally {
      log.finishedAt = new Date().toISOString()
      saveLog()
    }
  }
  private upsert(
    incoming: FinanceTransaction,
    raw: unknown,
    notify: boolean,
  ): boolean {
    const providerRow = incoming.providerId
      ? this.sql
          .exec<BodyRow>(
            'SELECT body FROM finance_transactions WHERE provider_id = ?',
            incoming.providerId,
          )
          .toArray()[0]
      : null
    const migrated = object(raw)._migrated
    const migratedRow =
      typeof migrated === 'string'
        ? this.sql
            .exec<BodyRow>(
              'SELECT body FROM finance_transactions WHERE provider_id = ?',
              migrated,
            )
            .toArray()[0]
        : null
    let existing = providerRow
      ? (JSON.parse(providerRow.body) as FinanceTransaction)
      : migratedRow
        ? (JSON.parse(migratedRow.body) as FinanceTransaction)
        : this.read<FinanceTransaction>('transactions', incoming.id)
    // Only a single exact pending candidate can be promoted. Ambiguity remains explicitly pending.
    if (!existing && incoming.status === 'settled') {
      const candidates = this.sql
        .exec<BodyRow>(
          "SELECT body FROM finance_transactions WHERE status IN ('pending', 'missing-pending') AND account_id = ? AND amount = ?",
          incoming.accountId,
          incoming.amount,
        )
        .toArray()
        .map((r) => JSON.parse(r.body) as FinanceTransaction)
        .filter(
          (t) =>
            t.description === incoming.description &&
            Math.abs(Date.parse(t.date) - Date.parse(incoming.date)) <=
              7 * 86400000,
        )
      if (candidates.length === 1) existing = candidates[0]
    }
    const id = existing?.id ?? incoming.id
    const rule = ruleFor(incoming, this.list('rules'))
    const fallback = incoming.providerCategory
      ? categoryId(incoming.providerCategory)
      : 'uncategorized'
    const category =
      rule?.category ??
      (this.read('categories', fallback) ? fallback : 'uncategorized')
    const tx = {
      ...incoming,
      id,
      category: existing?.category ?? category,
      ruleId: existing?.ruleId ?? rule?.id ?? null,
      importedAt: existing?.importedAt ?? incoming.importedAt,
    }
    this.storage.transactionSync(() => {
      this.sql.exec(
        'INSERT INTO finance_transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET provider_id=excluded.provider_id, date=excluded.date, amount=excluded.amount, status=excluded.status, raw=excluded.raw, body=excluded.body',
        id,
        tx.providerId,
        tx.accountId,
        tx.date,
        tx.amount,
        tx.status,
        JSON.stringify(raw),
        JSON.stringify(raw),
        JSON.stringify(tx),
      )
      // Pending items only notify once settled, preventing duplicate or unstable-pending alerts.
      if (
        (!existing || existing.status !== 'settled') &&
        tx.status === 'settled' &&
        notify &&
        this.settings().notifications
      )
        this.sql.exec(
          'INSERT OR IGNORE INTO finance_notifications(id, transaction_id, created_at) VALUES (?, ?, ?)',
          crypto.randomUUID(),
          id,
          incoming.observedAt,
        )
    })
    return !existing
  }
  async refresh(): Promise<void> {
    const requested = this.read<string>('settings', 'refresh-requested')
    if (requested && Date.now() - Date.parse(requested) < 3600000)
      throw new Error(
        'Refresh cooldown active. Akahu requires at least one hour between requests.',
      )
    // Reserve before awaiting so concurrent requests cannot request duplicate refreshes. Preserve uncertain outcomes.
    this.put('settings', 'refresh-requested', new Date().toISOString())
    await new AkahuClient(this.env).request('/refresh', 'POST')
  }
}

import { backup, restore } from './backup'
import { financeFilter } from './filters'
import type {
  FinanceBudget,
  FinanceCategory,
  FinanceEdit,
  FinanceRule,
  FinanceSettings,
} from '../../src/shared/types/finance'
import { json, readJson } from '../http'
import { object, text, type AkahuEnv } from './akahu'
import type { FinanceStore } from './store'
import { deliverPush, parseSubscription } from './push'
import { report } from './reports'
import { previewWorkbook } from './workbooks'
import { readReceipt, readReceiptFacts, receiptCandidates } from './receipts'

function short(value: unknown, max = 200): string {
  const s = text(value)
  if (s.length > max) throw new Error('Text too long')
  return s
}
function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Invalid option')
  return value
}
function optional(value: unknown): string | null {
  return value === null ? null : short(value)
}
export async function financeApi(
  request: Request,
  store: FinanceStore,
  storage: DurableObjectStorage,
  env: AkahuEnv,
): Promise<Response> {
  const url = new URL(request.url),
    path = url.pathname.slice('/api/finance'.length)
  try {
    if (request.method === 'GET') {
      if (path === '/backup') return backup(storage)
      if (!path) return json(store.metadata())
      if (path === '/reports')
        return json(
          storage.sql
            .exec<{
              id: string
              created_at: string
              body: string
              saved: number
            }>(
              'SELECT id, created_at, body, bytes IS NOT NULL AS saved FROM finance_exports ORDER BY created_at DESC, id DESC',
            )
            .toArray()
            .map((r) => ({
              ...JSON.parse(r.body),
              id: r.id,
              createdAt: r.created_at,
              saved: !!r.saved,
            })),
        )
      if (path.startsWith('/reports/')) {
        const preview = path.endsWith('/preview')
        const row = storage.sql
          .exec<{ body: string; bytes: ArrayBuffer | null }>(
            'SELECT body, bytes FROM finance_exports WHERE id = ?',
            decodeURIComponent(path.slice(9, preview ? -8 : undefined)),
          )
          .toArray()[0]
        if (!row?.bytes)
          return json(
            {
              error:
                'This older export has no saved file. Generate a new report.',
            },
            404,
          )
        const format = JSON.parse(row.body).format === 'xlsx' ? 'xlsx' : 'csv'
        if (preview) {
          if (format !== 'xlsx')
            throw new Error('Only Excel workbooks have a sheet preview')
          return json(await previewWorkbook(row.bytes))
        }
        return new Response(row.bytes, {
          headers: {
            'Content-Type':
              format === 'xlsx'
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                : 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="finance-report.${format}"`,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        })
      }
      if (path === '/recurring')
        return json(store.recurring(financeFilter(url)))
      if (path === '/metrics') return json(store.metrics(financeFilter(url)))
      if (path === '/transactions')
        return json(store.transactions(financeFilter(url)))
      if (path === '/export') return await report(store, storage, url)
      if (path.startsWith('/receipts/')) {
        const id = decodeURIComponent(path.slice(10)),
          row = storage.sql
            .exec<{ name: string; mime: string; bytes: ArrayBuffer }>(
              'SELECT name, mime, bytes FROM finance_attachments WHERE id = ?',
              id,
            )
            .toArray()[0]
        if (!row) return json({ error: 'Attachment not found' }, 404)
        return new Response(row.bytes, {
          headers: {
            'Content-Type': row.mime,
            'Content-Disposition': 'attachment; filename="receipt"',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'private, no-store',
          },
        })
      }
      if (path.startsWith('/transaction/')) {
        const id = decodeURIComponent(path.slice(13)),
          tx = store.transaction(id)
        return tx
          ? json({
              transaction: tx,
              audit: store.audit(id),
              attachments: storage.sql
                .exec(
                  'SELECT id, name, mime, created_at FROM finance_attachments WHERE transaction_id = ?',
                  id,
                )
                .toArray(),
              insight: store.savedInsight(id),
            })
          : json({ error: 'Transaction not found' }, 404)
      }
    }
    if (request.method !== 'POST') return json({ error: 'Not found' }, 404)
    if (path === '/sync') {
      await store.sync()
      await deliverPush(storage, env)
      return json(store.metadata())
    }
    if (path === '/refresh') {
      await store.refresh()
      return json({ requested: true })
    }
    if (path === '/push/test') {
      await deliverPush(storage, env, true)
      return json({ sent: true })
    }
    if (path === '/restore') {
      if (store.syncActive)
        throw new Error(
          'Wait for the active bank synchronisation before restoring',
        )
      if (request.headers.get('x-finance-confirm') !== 'RESTORE FINANCE BACKUP')
        throw new Error('Explicit restore confirmation is required')
      restore(storage, await readJson(request, 8 * 1024 * 1024))
      return json({ restored: true })
    }
    if (path === '/receipt-match') {
      const file = await readReceipt(request),
        facts = await readReceiptFacts(env, file)
      const candidates = receiptCandidates(
        facts,
        store.transactions(financeFilter(new URL(url.origin)), true).items,
      )
      return json({ ...facts, candidates })
    }
    if (path.startsWith('/receipts/')) {
      const id = decodeURIComponent(path.slice(10))
      if (!store.transaction(id))
        return json({ error: 'Transaction not found' }, 404)
      const { bytes, mime, name } = await readReceipt(request)
      storage.sql.exec(
        'INSERT INTO finance_attachments VALUES (?, ?, ?, ?, ?, ?)',
        crypto.randomUUID(),
        id,
        name,
        mime,
        new Date().toISOString(),
        bytes.buffer,
      )
      return json({ saved: true })
    }
    const body = object(await readJson(request, 32000))
    if (path === '/insight') {
      return json(await store.describe(short(body.id)))
    } else if (path === '/recurring') {
      store.confirmRecurring(
        short(body.id),
        bool(body.active),
        typeof body.notes === 'string' && body.notes.length < 10000
          ? body.notes
          : '',
      )
    } else if (path === '/review') {
      const input = object(body.input)
      if (
        !['needs-review', 'reviewed', 'later', 'ignored'].includes(
          String(input.review),
        ) ||
        !Array.isArray(input.tags) ||
        input.tags.length > 20 ||
        !Array.isArray(input.splits) ||
        input.splits.length > 50
      )
        throw new Error('Invalid review')
      const edit: FinanceEdit = {
        category: short(input.category),
        notes:
          typeof input.notes === 'string' && input.notes.length <= 10000
            ? input.notes
            : (() => {
                throw new Error('Invalid notes')
              })(),
        tags: input.tags.map((v) => short(v, 50)),
        review: input.review as FinanceEdit['review'],
        excluded: bool(input.excluded),
        transferId: optional(input.transferId),
        refundId: optional(input.refundId),
        splits: input.splits.map((v) => {
          const s = object(v)
          if (!Number.isSafeInteger(s.amount)) throw new Error('Invalid split')
          return { category: short(s.category), amount: s.amount as number }
        }),
        createRule: bool(input.createRule),
      }
      store.edit(short(body.id), edit)
    } else if (path === '/match') {
      if (body.kind !== 'transfer' && body.kind !== 'refund')
        throw new Error('Invalid matching type')
      store.match(short(body.first), short(body.second), body.kind)
    } else if (path === '/bulk') {
      if (
        !Array.isArray(body.ids) ||
        body.ids.length > 100 ||
        !['reviewed', 'needs-review', 'ignored'].includes(String(body.review))
      )
        throw new Error('Invalid bulk operation')
      if (
        body.category &&
        !store.metadata().categories.some((c) => c.id === body.category)
      )
        throw new Error('Invalid category')
      const records = body.ids.map((id) => store.transaction(short(id)))
      if (records.some((t) => !t)) throw new Error('Transaction not found')
      for (const tx of records)
        if (tx)
          store.edit(tx.id, {
            category:
              typeof body.category === 'string' && body.category
                ? body.category
                : tx.category,
            review: body.review as FinanceEdit['review'],
            notes: tx.notes,
            tags: tx.tags,
            excluded: tx.excluded,
            transferId: null,
            refundId: null,
            splits: tx.splits,
            createRule: false,
          })
    } else if (path === '/accounts') {
      store.saveAccount(
        short(body.id),
        bool(body.included),
        bool(body.archived),
      )
    } else if (path === '/categories/merge') {
      storage.transactionSync(() =>
        store.mergeCategories(short(body.from), short(body.to)),
      )
    } else if (path === '/categories') {
      const c = body
      if (!['income', 'expense', 'special'].includes(String(c.kind)))
        throw new Error('Invalid category type')
      store.saveCategory({
        id: short(c.id),
        name: short(c.name),
        kind: c.kind as FinanceCategory['kind'],
        hidden: bool(c.hidden),
        color: short(c.color),
        parentId: optional(c.parentId),
      })
    } else if (path === '/rules') {
      if (
        !['exact', 'contains'].includes(String(body.match)) ||
        !['any', 'debit', 'credit'].includes(String(body.direction)) ||
        !Number.isSafeInteger(body.priority)
      )
        throw new Error('Invalid rule')
      store.saveRule({
        id: short(body.id),
        text: short(body.text),
        match: body.match as FinanceRule['match'],
        category: short(body.category),
        priority: body.priority as number,
        enabled: bool(body.enabled),
        accountId: optional(body.accountId),
        direction: body.direction as FinanceRule['direction'],
      })
    } else if (path === '/budgets') {
      if (
        !Number.isSafeInteger(body.amount) ||
        (body.amount as number) <= 0 ||
        !['weekly', 'monthly'].includes(String(body.period)) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(String(body.start))
      )
        throw new Error('Invalid budget')
      store.saveBudget({
        id: short(body.id),
        category: optional(body.category),
        amount: body.amount as number,
        period: body.period as FinanceBudget['period'],
        start: short(body.start),
        archived: bool(body.archived),
      })
    } else if (path === '/settings') {
      if (body.currency !== 'NZD' || body.timezone !== 'Pacific/Auckland')
        throw new Error('Only NZD and Pacific/Auckland are currently supported')
      store.saveSettings({
        notifications: bool(body.notifications),
        push: bool(body.push),
        privateNotifications: bool(body.privateNotifications),
        currency: body.currency,
        timezone: body.timezone,
      } as FinanceSettings)
    } else if (path === '/notifications/read')
      typeof body.transactionId === 'string'
        ? store.markTransactionRead(short(body.transactionId))
        : store.markRead(short(body.id))
    else if (path === '/push') {
      const sub = parseSubscription(body),
        hash = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(sub.endpoint),
        )
      const id = Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      storage.sql.exec(
        'INSERT OR REPLACE INTO finance_push VALUES (?, ?)',
        id,
        JSON.stringify(sub),
      )
      // Never push an old backlog when the first device subscribes.
      storage.sql.exec(
        "UPDATE finance_notifications SET push_status='skipped' WHERE push_status='pending'",
      )
    } else return json({ error: 'Not found' }, 404)
    return json({ saved: true })
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error ? error.message : 'Finance operation failed',
      },
      400,
    )
  }
}

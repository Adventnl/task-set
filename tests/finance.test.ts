import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FinanceStore } from '../worker/finance/store'
import { AkahuClient, AkahuError } from '../worker/finance/akahu'
import { calculateMetrics, budgetPeriod } from '../worker/finance/calculations'
import {
  csvCell,
  minorUnits,
  nzDay,
  totals,
  validSplits,
} from '../src/shared/utils/finance'
import type {
  FinanceEdit,
  FinanceFilter,
  FinanceTransaction,
} from '../src/shared/types/finance'
import { report } from '../worker/finance/reports'
import ExcelJS from 'exceljs'
import { financeApi } from '../worker/finance/api'
import { categoryId, DEFAULT_CATEGORIES } from '../worker/finance/schema'
import { previewWorkbook } from '../worker/finance/workbooks'
import { backup, restore } from '../worker/finance/backup'
import { deliverPush, parseSubscription } from '../worker/finance/push'

const filter: FinanceFilter = {
  search: '',
  account: '',
  category: '',
  review: '',
  direction: '',
  start: '',
  end: '',
  min: '',
  max: '',
  tag: '',
  page: 0,
  oldest: false,
}
const env = {
  AKAHU_APP_TOKEN: 'fixture-app',
  AKAHU_USER_TOKEN: 'fixture-user',
}
const account = (id = 'acc_1') => ({
  _id: id,
  name: 'Everyday',
  connection: { _id: 'conn_anz', name: 'ANZ' },
  status: 'ACTIVE',
  type: 'CHECKING',
  formatted_account: '00-0000-0000000-000',
  balance: { current: 100.25, available: 90.25, currency: 'NZD' },
  refreshed: {
    balance: '2026-10-19T00:00:00Z',
    transactions: '2026-10-19T00:00:00Z',
  },
})
const tx = (id = 'tx_1', amount = -24.5, accountId = 'acc_1') => ({
  _id: id,
  _account: accountId,
  description: 'Countdown',
  amount,
  type: 'EFTPOS',
  date: '2026-10-19T01:00:00Z',
  updated_at: '2026-10-19T03:00:00Z',
})
function database(legacyCategories = true) {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  const storage = {
    sql: {
      exec(sql: string, ...params: (string | number | null)[]) {
        let rows: Record<string, unknown>[] = []
        if (
          params.length ||
          !sql.trim().endsWith(';') ||
          !sql.includes(';\n')
        ) {
          const statement = db.prepare(sql)
          rows = statement.all(
            ...params.map((v) =>
              v instanceof ArrayBuffer ? new Uint8Array(v) : v,
            ),
          ) as Record<string, unknown>[]
        } else db.exec(sql)
        return {
          toArray: () => rows,
          one: () => {
            if (rows.length !== 1) throw new Error('Expected one row')
            return rows[0]
          },
          [Symbol.iterator]: () => rows[Symbol.iterator](),
        }
      },
    },
    transactionSync<T>(fn: () => T): T {
      db.exec('BEGIN')
      try {
        const result = fn()
        db.exec('COMMIT')
        return result
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    },
  } as unknown as DurableObjectStorage
  const store = new FinanceStore(storage, env)
  // Explicit legacy fixture categories: new workspaces no longer seed templates.
  if (legacyCategories)
    for (const [kind, names] of Object.entries(DEFAULT_CATEGORIES))
      for (const name of names)
        if (name !== 'Uncategorized')
          store.saveCategory({
            id: categoryId(name),
            name,
            kind: kind as 'income' | 'expense' | 'special',
            hidden: false,
            color: 'amber',
            parentId: null,
          })
  return { db, storage, store }
}
function bank(initial: unknown[] = [tx()], pending: unknown[] = []) {
  let settled = initial,
    pendingItems = pending,
    outage = false
  const send = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input)),
      path = url.pathname
    if (outage) return Response.json({ success: false }, { status: 503 })
    if (path === '/v1/me')
      return Response.json({ success: true, item: { _id: 'owner' } })
    if (path === '/v1/accounts')
      return Response.json({
        success: true,
        items: [account(), account('acc_2')],
      })
    if (path === '/v1/transactions/pending')
      return Response.json({ success: true, items: pendingItems })
    if (path === '/v1/refresh') return Response.json({ success: true })
    return Response.json({
      success: true,
      items: settled,
      cursor: { next: null },
    })
  })
  vi.stubGlobal('fetch', send)
  return {
    send,
    set(items: unknown[]) {
      settled = items
    },
    pending(items: unknown[]) {
      pendingItems = items
    },
    outage() {
      outage = true
    },
  }
}
afterEach(() => vi.unstubAllGlobals())

describe('financial integrity', () => {
  it('uses exact cents and rejects invalid money', () => {
    expect(minorUnits('24.50')).toBe(2450)
    expect(minorUnits(-0.29)).toBe(-29)
    for (const v of [NaN, Infinity, '1.005', '1e12', null, '9007199254740992'])
      expect(() => minorUnits(v)).toThrow()
  })
  it('uses Auckland dates through DST and checks splits', () => {
    expect(nzDay('2026-10-18T12:30:00Z')).toBe('2026-10-19')
    expect(
      validSplits(-2450, [
        { category: 'a', amount: -2000 },
        { category: 'b', amount: -450 },
      ]),
    ).toBe(true)
    expect(validSplits(-2450, [{ category: 'a', amount: -2450 }])).toBe(false)
  })
  it('neutralises spreadsheet formulas', () => {
    expect(csvCell(' =HYPERLINK("x")')).toBe('"\' =HYPERLINK(""x"")"')
    expect(csvCell('a,b')).toBe('"a,b"')
  })
  it('anchors weekly and monthly budgets to configured local dates', () => {
    const budget = {
      id: 'b',
      category: null,
      amount: 1000,
      archived: false,
      start: '2026-01-31',
      period: 'monthly' as const,
    }
    expect(budgetPeriod(budget, '2026-02-28')).toEqual({
      start: '2026-02-28',
      end: '2026-03-30',
    })
    expect(
      budgetPeriod(
        { ...budget, period: 'weekly', start: '2026-10-01' },
        '2026-10-09',
      ),
    ).toEqual({ start: '2026-10-08', end: '2026-10-14' })
  })
})
describe('persistent bank synchronisation', () => {
  it('imports silently, is idempotent, and preserves personal metadata on bank corrections', async () => {
    const { store, db } = database(),
      upstream = bank()
    await store.sync()
    expect(store.metadata()).toMatchObject({
      initialized: true,
      transactionCount: 1,
      notifications: [],
    })
    expect(store.metadata().accounts[0]).toMatchObject({
      current: 10025,
      available: 9025,
      masked: '•••• 0000',
    })
    const edit: FinanceEdit = {
      category: 'groceries',
      notes: 'Birthday dinner',
      tags: ['family'],
      review: 'reviewed',
      excluded: false,
      transferId: null,
      refundId: null,
      splits: [],
      createRule: true,
    }
    store.edit('tx_1', edit)
    await store.sync()
    upstream.set([{ ...tx(), description: 'Updated Countdown', amount: -25 }])
    await store.sync()
    expect(store.transaction('tx_1')).toMatchObject({
      notes: 'Birthday dinner',
      tags: ['family'],
      category: 'groceries',
      review: 'reviewed',
      amount: -2500,
      description: 'Updated Countdown',
    })
    expect(store.metadata().notifications).toHaveLength(0)
    expect(store.metadata().rules).toHaveLength(1)
    expect(store.metadata().balances).toHaveLength(2)
    expect(
      db.prepare('SELECT original_raw, raw FROM finance_transactions').get(),
    ).not.toHaveProperty(
      'original_raw',
      JSON.stringify({
        ...tx(),
        description: 'Updated Countdown',
        amount: -25,
      }),
    )
    upstream.set([tx('tx_2')])
    await store.sync()
    await store.sync()
    expect(store.metadata().transactionCount).toBe(2)
    expect(store.metadata().notifications).toHaveLength(1)
    expect(store.transaction('tx_2')?.category).toBe('groceries')
  })
  it('retains settled history through outages and older records disappearing upstream', async () => {
    const { store } = database(),
      api = bank()
    await store.sync()
    api.set([])
    await store.sync()
    expect(store.metadata().transactionCount).toBe(1)
    api.outage()
    await expect(store.sync()).rejects.toThrow()
    expect(store.metadata().transactionCount).toBe(1)
    expect(store.metadata().syncs.some((s) => s.status === 'failed')).toBe(true)
  })
  it('promotes a unique pending transaction and preserves annotations with just one settlement alert', async () => {
    const { store } = database(),
      api = bank([], [tx()])
    await store.sync()
    const pending = store.transactions(filter).items[0]
    store.edit(pending.id, {
      category: 'groceries',
      notes: 'Retain me',
      tags: [],
      review: 'reviewed',
      excluded: false,
      transferId: null,
      refundId: null,
      splits: [],
      createRule: false,
    })
    api.pending([])
    api.set([tx()])
    await store.sync()
    await store.sync()
    expect(store.metadata().transactionCount).toBe(1)
    expect(store.transaction(pending.id)).toMatchObject({
      providerId: 'tx_1',
      status: 'settled',
      notes: 'Retain me',
    })
    expect(store.metadata().notifications).toHaveLength(1)
  })
  it('retains ambiguous duplicate pending purchases independently', async () => {
    const { store } = database()
    bank([], [tx(), tx()])
    await store.sync()
    expect(store.metadata().transactionCount).toBe(2)
    expect(
      new Set(store.transactions(filter).items.map((t) => t.id)).size,
    ).toBe(2)
  })
  it('coalesces simultaneous synchronisations and reserves the refresh cooldown', async () => {
    const { store } = database(),
      api = bank()
    await Promise.all([store.sync(), store.sync()])
    expect(store.metadata().syncs).toHaveLength(1)
    await store.refresh()
    await expect(store.refresh()).rejects.toThrow('cooldown')
    expect(
      api.send.mock.calls.filter(([u]) => String(u).endsWith('/refresh')),
    ).toHaveLength(1)
  })
  it('keeps transfers and refunds out of inflated consolidated totals', async () => {
    const { store } = database()
    bank([
      tx('out', -500),
      tx('in', 500, 'acc_2'),
      tx('purchase', -100),
      tx('refund', 20),
    ])
    await store.sync()
    store.match('out', 'in', 'transfer')
    store.match('purchase', 'refund', 'refund')
    expect(totals(store.transactions(filter).items)).toEqual({
      income: 0,
      expenses: 8000,
      net: -8000,
    })
    expect(store.audit('purchase')).toHaveLength(1)
  })
  it('filters Auckland dates, signed direction, notes and cents on the server', async () => {
    const { store } = database()
    bank([{ ...tx(), date: '2026-10-18T12:30:00Z' }])
    await store.sync()
    expect(
      store.transactions({
        ...filter,
        start: '2026-10-19',
        end: '2026-10-19',
        min: '24',
        max: '25',
        direction: 'debit',
      }).total,
    ).toBe(1)
    expect(store.transactions({ ...filter, end: '2026-10-18' }).total).toBe(0)
  })
})
describe('Akahu boundary', () => {
  it('calls native fetch without binding the Akahu client as its receiver', async () => {
    const nativeFetch = vi.fn(async function (this: unknown) {
      // workerd rejects native fetch when called with a client instance as `this`.
      if (this !== undefined && this !== globalThis)
        throw new TypeError('Illegal invocation')
      return Response.json({ success: true, item: { _id: 'owner' } })
    })
    vi.stubGlobal('fetch', nativeFetch)
    await expect(new AkahuClient(env).request('/me')).resolves.toMatchObject({
      success: true,
    })
    expect(nativeFetch).toHaveBeenCalledTimes(1)
  })
  it('reports the failing endpoint and status without exposing credentials, query parameters or upstream bodies', async () => {
    const api = new AkahuClient(
      env,
      vi.fn(async () =>
        Response.json(
          { message: 'private upstream data fixture-user' },
          { status: 400 },
        ),
      ),
    )
    await expect(
      api.request('/transactions?cursor=private-cursor'),
    ).rejects.toThrow('Endpoint: /transactions. HTTP 400.')
    try {
      await api.request('/me')
    } catch (error) {
      expect((error as Error).message).not.toMatch(
        /fixture-user|fixture-app|private upstream|private-cursor/,
      )
    }
  })
  it('distinguishes invalid JSON from unsuccessful envelopes', async () => {
    await expect(
      new AkahuClient(
        env,
        vi.fn(async () => new Response('<html>private upstream</html>')),
      ).request('/me'),
    ).rejects.toThrow('Response was not a valid JSON object')
    await expect(
      new AkahuClient(
        env,
        vi.fn(async () => Response.json({ items: [] })),
      ).request('/accounts'),
    ).rejects.toThrow('Response did not confirm success')
  })
  it('follows opaque cursors even after an empty page without leaking headers to another host', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          items: [],
          cursor: { next: 'opaque&cursor' },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ success: true, items: [tx()], cursor: { next: null } }),
      )
    const client = new AkahuClient(env, send)
    const pages = []
    for await (const page of client.transactions('2026-01-01', '2026-10-19'))
      pages.push(page)
    expect(pages).toHaveLength(2)
    expect(send.mock.calls[1][0]).toContain('opaque%26cursor')
    expect(send.mock.calls[0][1]).toMatchObject({
      redirect: 'manual',
      headers: {
        Authorization: 'Bearer fixture-user',
        'X-Akahu-Id': 'fixture-app',
      },
    })
  })
  it.each([401, 403, 429, 503])(
    'rejects %s rather than treating a failure as empty history',
    async (status) => {
      const api = new AkahuClient(
        env,
        vi.fn(async () => Response.json({ success: false }, { status })),
      )
      await expect(api.list('/accounts')).rejects.toBeInstanceOf(AkahuError)
    },
  )
  it('rejects repeated pagination cursors and malformed response envelopes', async () => {
    const api = new AkahuClient(
      env,
      vi.fn(async () =>
        Response.json({ success: true, items: [], cursor: { next: 'repeat' } }),
      ),
    )
    await expect(
      (async () => {
        for await (const _ of api.transactions('a', 'b')) {
          /* consume */
        }
      })(),
    ).rejects.toThrow()
    await expect(
      new AkahuClient(
        env,
        vi.fn(async () => Response.json({ items: [] })),
      ).list('/accounts'),
    ).rejects.toThrow()
  })
  it('refuses SSRF push endpoints', () => {
    expect(() =>
      parseSubscription({
        endpoint: 'https://127.0.0.1/admin',
        keys: { p256dh: 'a'.repeat(87), auth: 'b'.repeat(22) },
      }),
    ).toThrow('Unsupported')
  })
})
describe('reports and validation', () => {
  it('generates real typed Excel rows and reconciled summary totals', async () => {
    const { store, storage } = database()
    bank()
    await store.sync()
    const response = await report(
      store,
      storage,
      new URL('https://app.test/api/finance/export?format=xlsx'),
    )
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await response.arrayBuffer())
    expect(workbook.getWorksheet('Transactions')?.getCell('I2').value).toBe(
      -24.5,
    )
    expect(
      workbook.getWorksheet('Transactions')?.getCell('C2').value,
    ).toBeInstanceOf(Date)
    expect(workbook.getWorksheet('Summary')?.getCell('B5').value).toBe(24.5)
  })
  it('rejects invalid reviews without altering stored records', async () => {
    const { store, storage } = database()
    bank()
    await store.sync()
    const response = await financeApi(
      new Request('https://app.test/api/finance/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'tx_1',
          input: { notes: 'overwrite', review: 'invalid' },
        }),
      }),
      store,
      storage,
      env,
    )
    expect(response.status).toBe(400)
    expect(store.transaction('tx_1')?.notes).toBe('')
  })
  it('calculates budgets using split amounts without counting parent twice', async () => {
    const { store } = database()
    bank()
    await store.sync()
    const t = store.transaction('tx_1')!
    const edited: FinanceTransaction = {
      ...t,
      splits: [
        { category: 'groceries', amount: -2000 },
        { category: 'gifts', amount: -450 },
      ],
    }
    const m = calculateMetrics(
      [edited],
      [edited],
      [
        {
          id: 'b',
          category: 'groceries',
          amount: 10000,
          period: 'monthly',
          start: '2026-10-01',
          archived: false,
        },
      ],
      '2026-10-19',
    )
    expect(m.expenses).toBe(2450)
    expect(m.budgetUsage[0].spent).toBe(2000)
  })
})

describe('automation, attachments and report variants', () => {
  it('detects recurring candidates but requires explicit confirmation', async () => {
    const { store } = database()
    bank(
      ['2026-08-19', '2026-09-19', '2026-10-19'].map((day, i) => ({
        ...tx('recurring-' + i, -19.99),
        date: day + 'T00:00:00Z',
        description: 'Spotify',
      })),
    )
    await store.sync()
    expect(store.recurring(filter)).toMatchObject([
      { merchant: 'Spotify', frequency: 'monthly', confirmed: false },
    ])
    const candidate = store.recurring(filter)[0]
    store.confirmRecurring(candidate.id, true, 'Music')
    expect(store.recurring(filter)[0]).toMatchObject({
      confirmed: true,
      notes: 'Music',
      active: true,
    })
  })
  it('serves private receipts only through the authenticated API boundary and validates their type', async () => {
    const { store, storage } = database()
    bank()
    await store.sync()
    const upload = (mime: string, bytes: Uint8Array) =>
      financeApi(
        new Request('https://app.test/api/finance/receipts/tx_1', {
          method: 'POST',
          headers: { 'Content-Type': mime, 'X-Filename': 'private.pdf' },
          body: bytes,
        }),
        store,
        storage,
        env,
      )
    expect(
      (await upload('application/pdf', new TextEncoder().encode('not a PDF')))
        .status,
    ).toBe(400)
    expect(
      (
        await upload(
          'application/pdf',
          new TextEncoder().encode('%PDF-1.7\nfixture'),
        )
      ).status,
    ).toBe(200)
    const detail = await (
      await financeApi(
        new Request('https://app.test/api/finance/transaction/tx_1'),
        store,
        storage,
        env,
      )
    ).json()
    expect(detail.attachments).toHaveLength(1)
    expect(store.transactions(filter).items[0].receiptCount).toBe(1)
    const receipt = await financeApi(
      new Request(
        'https://app.test/api/finance/receipts/' + detail.attachments[0].id,
      ),
      store,
      storage,
      env,
    )
    expect(receipt.headers.get('cache-control')).toContain('no-store')
    expect(receipt.headers.get('content-disposition')).toContain('attachment')
    expect(await receipt.text()).toContain('%PDF')
  })
  it.each([
    'Monthly Financial Summary',
    'Annual Financial Summary',
    'Income and Expense Statement',
    'Cash Flow Summary',
    'Category Spending Breakdown',
    'Merchant Spending Report',
    'Account Balance History',
    'Budget Versus Actual Report',
    'Recurring Payment Summary',
    'Custom Date Range Report',
  ])('exports %s from stored records', async (type) => {
    const { store, storage } = database()
    bank()
    await store.sync()
    const response = await report(
      store,
      storage,
      new URL(
        'https://app.test/api/finance/export?format=csv&type=' +
          encodeURIComponent(type),
      ),
    )
    expect(response.status).toBe(200)
    expect((await response.text()).length).toBeGreaterThan(10)
  })
})

describe('Web Push outbox', () => {
  it('does not redeliver accepted events after another device fails and new events arrive', async () => {
    const { store, storage, db } = database(),
      upstream = bank([])
    await store.sync()
    upstream.set([tx('new-1')])
    await store.sync()
    store.saveSettings({
      notifications: true,
      push: true,
      privateNotifications: true,
      currency: 'NZD',
      timezone: 'Pacific/Auckland',
    })
    const pair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify'],
      ),
      key = await crypto.subtle.exportKey('jwk', pair.privateKey)
    const publicKey = Buffer.concat([
      Buffer.from([4]),
      Buffer.from(key.x!, 'base64url'),
      Buffer.from(key.y!, 'base64url'),
    ]).toString('base64url')
    const pushEnv = {
      VAPID_PUBLIC_KEY: publicKey,
      VAPID_PRIVATE_KEY: key.d!,
      VAPID_SUBJECT: 'mailto:finance@example.com',
    }
    for (const id of ['device-a', 'device-b'])
      storage.sql.exec(
        'INSERT INTO finance_push VALUES (?, ?)',
        id,
        JSON.stringify({
          endpoint: 'https://fcm.googleapis.com/fcm/send/' + id,
          expirationTime: null,
          keys: {
            p256dh: publicKey,
            auth: Buffer.alloc(16, 5).toString('base64url'),
          },
        }),
      )
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (url: string) =>
          new Response(null, { status: url.endsWith('device-a') ? 201 : 503 }),
      ),
    )
    await deliverPush(storage, pushEnv)
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM finance_push_deliveries').get()
        ?.count,
    ).toBe(1)
    const alreadySent = db
      .prepare('SELECT id FROM finance_push_deliveries')
      .get()?.id
    const bankAgain = bank([tx('new-1'), tx('new-2')])
    await store.sync()
    const send = vi.fn(async () => new Response(null, { status: 201 }))
    vi.stubGlobal('fetch', send)
    await deliverPush(storage, pushEnv)
    expect(send).toHaveBeenCalledTimes(2)
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM finance_push_deliveries').get()
        ?.count,
    ).toBe(4)
    expect(
      db
        .prepare('SELECT id FROM finance_push_deliveries WHERE id = ?')
        .get(alreadySent as string),
    ).toBeTruthy()
    await deliverPush(storage, pushEnv)
    expect(send).toHaveBeenCalledTimes(2)
    expect(bankAgain.send).toHaveBeenCalled()
  })
})

it('allocates matched refunds to the original category and permits multiple partial credits up to its amount', async () => {
  const { store } = database()
  bank([
    tx('purchase', -100),
    tx('refund-1', 20),
    tx('refund-2', 30),
    tx('too-much', 60),
  ])
  await store.sync()
  store.edit('purchase', {
    category: 'groceries',
    notes: '',
    tags: [],
    review: 'reviewed',
    excluded: false,
    transferId: null,
    refundId: null,
    splits: [],
    createRule: false,
  })
  store.match('purchase', 'refund-1', 'refund')
  store.match('purchase', 'refund-2', 'refund')
  expect(store.transaction('refund-1')?.category).toBe('groceries')
  expect(store.transaction('refund-2')?.category).toBe('groceries')
  expect(() => store.match('purchase', 'too-much', 'refund')).toThrow('exceed')
})

it('round-trips a private database backup and rolls back incomplete restores', async () => {
  const { backup, restore } = await import('../worker/finance/backup'),
    source = database()
  bank()
  await source.store.sync()
  const value = await backup(source.storage).json(),
    target = database()
  restore(target.storage, value)
  expect(target.store.transaction('tx_1')?.amount).toBe(-2450)
  const corrupted = structuredClone(value)
  delete corrupted.tables.accounts
  expect(() => restore(target.storage, corrupted)).toThrow('Incomplete')
  expect(target.store.metadata().transactionCount).toBe(1)
})

it('merges categories across reviewed transactions, splits, rules and budgets without changing bank facts', async () => {
  const { store, storage } = database()
  bank()
  await store.sync()
  store.edit('tx_1', {
    category: 'groceries',
    notes: 'Keep this',
    tags: ['family'],
    review: 'reviewed',
    excluded: false,
    transferId: null,
    refundId: null,
    splits: [
      { category: 'groceries', amount: -2000 },
      { category: 'gifts', amount: -450 },
    ],
    createRule: true,
  })
  store.saveBudget({
    id: 'food-budget',
    category: 'groceries',
    amount: 40000,
    period: 'monthly',
    start: '2026-10-01',
    archived: false,
  })
  const reviewedAt = store.transaction('tx_1')?.reviewedAt
  storage.transactionSync(() =>
    store.mergeCategories('groceries', 'restaurants'),
  )
  expect(store.transaction('tx_1')).toMatchObject({
    amount: -2450,
    description: 'Countdown',
    category: 'restaurants',
    notes: 'Keep this',
    reviewedAt,
    splits: [
      { category: 'restaurants', amount: -2000 },
      { category: 'gifts', amount: -450 },
    ],
  })
  expect(store.metadata().rules[0].category).toBe('restaurants')
  expect(store.metadata().budgets[0].category).toBe('restaurants')
  expect(
    store.metadata().categories.find((c) => c.id === 'groceries')?.hidden,
  ).toBe(true)
})
it('rejects cycles in category parent relationships', () => {
  const { store } = database()
  store.saveCategory({
    id: 'parent',
    name: 'Parent',
    kind: 'expense',
    hidden: false,
    color: 'amber',
    parentId: null,
  })
  store.saveCategory({
    id: 'child',
    name: 'Child',
    kind: 'expense',
    hidden: false,
    color: 'amber',
    parentId: 'parent',
  })
  expect(() =>
    store.saveCategory({
      id: 'parent',
      name: 'Parent',
      kind: 'expense',
      hidden: false,
      color: 'amber',
      parentId: 'child',
    }),
  ).toThrow('cycle')
})
it('preserves annotations when Akahu supplies a migrated transaction identity', async () => {
  const { store } = database(),
    upstream = bank()
  await store.sync()
  store.edit('tx_1', {
    category: 'groceries',
    notes: 'Retain across migration',
    tags: [],
    review: 'reviewed',
    excluded: false,
    transferId: null,
    refundId: null,
    splits: [],
    createRule: false,
  })
  upstream.set([{ ...tx('tx_migrated'), _migrated: 'tx_1' }])
  await store.sync()
  await store.sync()
  expect(store.metadata().transactionCount).toBe(1)
  expect(store.transaction('tx_1')).toMatchObject({
    providerId: 'tx_migrated',
    notes: 'Retain across migration',
  })
  expect(store.metadata().notifications).toHaveLength(0)
})
it('marks a missing upstream record without deleting it, then clears the warning when it returns', async () => {
  const { store } = database(),
    upstream = bank()
  await store.sync()
  upstream.set([])
  await store.sync()
  expect(store.transaction('tx_1')?.upstreamMissingAt).toBeTruthy()
  upstream.set([tx()])
  await store.sync()
  expect(store.transaction('tx_1')?.upstreamMissingAt).toBeUndefined()
  expect(store.metadata().transactionCount).toBe(1)
})
it('compares exact cent amount bounds rather than fractional binary products', async () => {
  const { store } = database()
  bank([tx('small', -0.29)])
  await store.sync()
  expect(
    store.transactions({ ...filter, min: '0.29', max: '0.29' }).total,
  ).toBe(1)
})

it('starts with only the internal uncategorised state and persists user-created categories across reopen', () => {
  const { store, storage } = database(false)
  expect(store.metadata().categories.map((c) => c.id)).toEqual([
    'uncategorized',
  ])
  store.saveCategory({
    id: 'my-food',
    name: 'Food expenses',
    kind: 'expense',
    hidden: false,
    color: 'amber',
    parentId: null,
  })
  expect(
    new FinanceStore(storage, env).metadata().categories.map((c) => c.name),
  ).toContain('Food expenses')
  expect(() =>
    store.saveCategory({
      id: 'duplicate',
      name: ' food EXPENSES ',
      kind: 'expense',
      hidden: false,
      color: 'amber',
      parentId: null,
    }),
  ).toThrow('already exists')
})

it('coalesces merchant descriptions, caches abstentions and invalidates context after bank corrections', async () => {
  const { store, storage } = database(false),
    upstream = bank()
  await store.sync()
  const run = vi.fn().mockResolvedValue({
    response: { certain: false, description: null, evidence: '' },
  })
  const enabled = new FinanceStore(storage, {
    ...env,
    AI: { run } as unknown as Env['AI'],
  })
  await Promise.all([enabled.describe('tx_1'), enabled.describe('tx_1')])
  await enabled.describe('tx_1')
  expect(run).toHaveBeenCalledTimes(1)
  expect(enabled.savedInsight('tx_1')?.description).toBeNull()
  upstream.set([{ ...tx(), description: 'Different merchant' }])
  await enabled.sync()
  expect(enabled.savedInsight('tx_1')).toBeNull()
  await enabled.describe('tx_1')
  expect(run).toHaveBeenCalledTimes(2)
  expect(enabled.transaction('tx_1')).toMatchObject({
    notes: '',
    category: 'uncategorized',
  })
})
it('removes untouched unused legacy templates while retaining used and edited categories during migration', async () => {
  const { store, storage } = database(false)
  bank()
  await store.sync()
  for (const name of ['Groceries', 'Restaurants', 'Shopping']) {
    storage.sql.exec(
      'INSERT INTO finance_categories VALUES (?, ?)',
      categoryId(name),
      JSON.stringify({
        id: categoryId(name),
        name: name === 'Shopping' ? 'My shopping' : name,
        kind: 'expense',
        hidden: false,
        color: 'amber',
        parentId: null,
      }),
    )
  }
  store.edit('tx_1', {
    category: 'groceries',
    notes: '',
    tags: [],
    review: 'reviewed',
    excluded: false,
    transferId: null,
    refundId: null,
    splits: [],
    createRule: false,
  })
  storage.sql.exec(
    "DELETE FROM finance_settings WHERE id = 'custom-categories-v1'",
  )
  const reopened = new FinanceStore(storage, env)
  expect(reopened.metadata().categories.map((c) => c.id)).toEqual(
    expect.arrayContaining(['groceries', 'shopping', 'uncategorized']),
  )
  expect(reopened.metadata().categories.map((c) => c.id)).not.toContain(
    'restaurants',
  )
  expect(reopened.transaction('tx_1')?.category).toBe('groceries')
})
it('retains exact report binaries, lists reports, previews workbook sheets and round-trips saved files in backups', async () => {
  const { store, storage } = database()
  bank()
  await store.sync()
  const first = await report(
    store,
    storage,
    new URL('https://local/api/finance/export?format=xlsx'),
  )
  const bytes = await first.arrayBuffer()
  const list = await financeApi(
    new Request('https://local/api/finance/reports'),
    store,
    storage,
    env,
  )
  const records = (await list.json()) as { id: string; saved: boolean }[]
  expect(records).toHaveLength(1)
  expect(records[0].saved).toBe(true)
  const download = await financeApi(
    new Request(`https://local/api/finance/reports/${records[0].id}`),
    store,
    storage,
    env,
  )
  expect(new Uint8Array(await download.arrayBuffer())).toEqual(
    new Uint8Array(bytes),
  )
  expect(download.headers.get('Cache-Control')).toBe('private, no-store')
  const preview = await previewWorkbook(bytes)
  expect(preview.sheets.map((s) => s.name)).toEqual([
    'Summary',
    'Transactions',
    'Observed Balances',
    'Categories',
  ])
  expect(
    preview.sheets.find((s) => s.name === 'Transactions')?.rows[1],
  ).toContain('Countdown')
  const route = await financeApi(
    new Request(`https://local/api/finance/reports/${records[0].id}/preview`),
    store,
    storage,
    env,
  )
  expect(await route.json()).toEqual(preview)
  const target = database(false)
  restore(target.storage, await backup(storage).json())
  const restored = await financeApi(
    new Request(`https://local/api/finance/reports/${records[0].id}`),
    target.store,
    target.storage,
    env,
  )
  expect(new Uint8Array(await restored.arrayBuffer())).toEqual(
    new Uint8Array(bytes),
  )
  const old = (await backup(storage).json()) as {
    tables: { exports: Record<string, unknown>[] }
  }
  for (const row of old.tables.exports) delete row.bytes
  restore(target.storage, old)
  const historical = await financeApi(
    new Request('https://local/api/finance/reports'),
    target.store,
    target.storage,
    env,
  )
  expect(await historical.json()).toMatchObject([{ saved: false }])
})

const categoryDeletionEdit: FinanceEdit = {
  category: 'groceries',
  notes: '',
  tags: [],
  review: 'reviewed',
  excluded: false,
  transferId: null,
  refundId: null,
  splits: [],
  createRule: false,
}

it('deletes a category atomically, moves split assignments, rules and budgets, and preserves bank facts and review metadata', async () => {
  const { store, storage } = database()
  bank()
  await store.sync()
  store.saveCategory({
    id: 'child',
    name: 'Child category',
    kind: 'expense',
    hidden: false,
    color: 'amber',
    parentId: 'groceries',
  })
  store.edit('tx_1', {
    ...categoryDeletionEdit,
    category: 'groceries',
    review: 'reviewed',
    notes: 'Keep my note',
    splits: [
      { category: 'groceries', amount: -2000 },
      { category: 'gifts', amount: -450 },
    ],
  })
  store.saveRule({
    id: 'delete-rule',
    text: 'Countdown',
    match: 'exact',
    category: 'groceries',
    priority: 100,
    enabled: true,
    accountId: null,
    direction: 'debit',
  })
  store.saveBudget({
    id: 'delete-budget',
    category: 'groceries',
    amount: 10000,
    period: 'monthly',
    start: '2026-10-01',
    archived: false,
  })
  const before = store.transaction('tx_1')!
  const raw = storage.sql
    .exec(
      'SELECT original_raw, raw, body FROM finance_transactions WHERE id = ?',
      'tx_1',
    )
    .toArray()
  const response = await financeApi(
    new Request('https://local/api/finance/categories/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'groceries', replacement: 'restaurants' }),
    }),
    store,
    storage,
    env,
  )
  expect(response.status).toBe(200)
  expect(store.metadata().categories.some((c) => c.id === 'groceries')).toBe(
    false,
  )
  expect(store.transaction('tx_1')).toMatchObject({
    amount: before.amount,
    notes: before.notes,
    tags: before.tags,
    reviewedAt: before.reviewedAt,
    review: before.review,
    transferId: before.transferId,
    refundId: before.refundId,
    category: 'restaurants',
    splits: [
      { category: 'restaurants', amount: -2000 },
      { category: 'gifts', amount: -450 },
    ],
  })
  expect(
    storage.sql
      .exec(
        'SELECT original_raw, raw, body FROM finance_transactions WHERE id = ?',
        'tx_1',
      )
      .toArray(),
  ).toEqual(raw)
  expect(store.metadata().categoryCounts).toMatchObject({
    restaurants: 1,
    gifts: 1,
  })
  expect(
    store.metadata().rules.find((r) => r.id === 'delete-rule'),
  ).toMatchObject({ category: 'restaurants', enabled: true })
  expect(
    store.metadata().budgets.find((b) => b.id === 'delete-budget'),
  ).toMatchObject({ category: 'restaurants', archived: false })
  expect(
    store.metadata().categories.find((c) => c.id === 'child')?.parentId,
  ).toBeNull()
  expect(store.audit('tx_1')).toHaveLength(2)
  expect(new FinanceStore(storage, env).transaction('tx_1')?.category).toBe(
    'restaurants',
  )
})

it('protects the internal category and validates replacements before deletion; uncategorised disables future rules', async () => {
  const { store } = database()
  bank()
  await store.sync()
  store.edit('tx_1', {
    ...categoryDeletionEdit,
    category: 'groceries',
    createRule: true,
  })
  store.saveBudget({
    id: 'budget',
    category: 'groceries',
    amount: 10000,
    period: 'monthly',
    start: '2026-10-01',
    archived: false,
  })
  expect(() => store.deleteCategory('uncategorized', 'groceries')).toThrow(
    'cannot be deleted',
  )
  expect(() => store.deleteCategory('groceries', 'groceries')).toThrow(
    'different',
  )
  expect(() => store.deleteCategory('groceries', 'missing')).toThrow(
    'different',
  )
  expect(store.transaction('tx_1')?.category).toBe('groceries')
  store.deleteCategory('groceries', 'uncategorized')
  expect(store.transaction('tx_1')).toMatchObject({
    category: 'uncategorized',
    review: 'reviewed',
  })
  expect(store.metadata().rules[0]).toMatchObject({
    category: 'uncategorized',
    enabled: false,
  })
  expect(store.metadata().budgets[0]).toMatchObject({
    category: 'uncategorized',
    archived: true,
  })
  expect(store.metadata().categoryCounts?.uncategorized).toBe(1)
})

it('browses every workbook row and column with bounded pages and rejects invalid sheet requests', async () => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Large register')
  sheet.addRow(Array.from({ length: 25 }, (_, i) => `Column ${i + 1}`))
  for (let i = 1; i <= 328; i++)
    sheet.addRow(
      Array.from({ length: 25 }, (_, j) => `Row ${i} column ${j + 1}`),
    )
  workbook.addWorksheet('Empty')
  const bytes = (await workbook.xlsx.writeBuffer()) as ArrayBuffer
  const first = await previewWorkbook(bytes, 0, 0)
  expect(first.sheets[0]).toMatchObject({
    totalRows: 329,
    totalColumns: 25,
    page: 0,
  })
  expect(first.sheets[0].rows).toHaveLength(51)
  const last = await previewWorkbook(bytes, 6, 0)
  expect(last.sheets[0].rows).toHaveLength(29)
  expect(last.sheets[0].rows[28][24]).toBe('Row 328 column 25')
  expect(last.sheets[1].rows).toEqual([])
  expect((await previewWorkbook(bytes, 100, 0)).sheets[0].page).toBe(6)
  expect((await previewWorkbook(bytes, 0, 1)).sheets[1].rows).toEqual([])
  await expect(previewWorkbook(bytes, -1)).rejects.toThrow('Invalid')
  await expect(previewWorkbook(bytes, 0, 2)).rejects.toThrow('not found')
})

it('creates an Excel report for browser viewing and retains the identical downloadable file', async () => {
  const { store, storage } = database()
  bank()
  await store.sync()
  const created = await financeApi(
    new Request('https://local/api/finance/export?format=xlsx&view=1'),
    store,
    storage,
    env,
  )
  expect(created.headers.get('Content-Type')).toContain('application/json')
  const { id } = (await created.json()) as { id: string }
  const preview = await financeApi(
    new Request(
      `https://local/api/finance/reports/${id}/preview?sheet=1&page=0`,
    ),
    store,
    storage,
    env,
  )
  const data = (await preview.json()) as Awaited<
    ReturnType<typeof previewWorkbook>
  >
  expect(data.sheets[1].rows[1]).toContain('Countdown')
  expect(data.sheets[1].rows[1]).toContain('2026-10-19 01:00 UTC')
  expect(data.sheets[1].rows[1]).toContain('-$24.50')
  const download = await financeApi(
    new Request(`https://local/api/finance/reports/${id}`),
    store,
    storage,
    env,
  )
  expect(download.status).toBe(200)
  expect(download.headers.get('Content-Type')).toContain('spreadsheetml')
})

it('rolls back every annotation when a category deletion cannot finish', async () => {
  const { store, storage } = database()
  bank()
  await store.sync()
  store.edit('tx_1', categoryDeletionEdit)
  const original = store.transaction('tx_1')
  const exec = storage.sql.exec.bind(storage.sql)
  const failure = vi
    .spyOn(storage.sql, 'exec')
    .mockImplementation((query: string, ...params: unknown[]) => {
      if (query.startsWith('DELETE FROM finance_categories'))
        throw new Error('Synthetic write failure')
      return exec(query, ...(params as SqlStorageValue[]))
    })
  expect(() => store.deleteCategory('groceries', 'restaurants')).toThrow(
    'Synthetic write failure',
  )
  failure.mockRestore()
  expect(store.transaction('tx_1')).toEqual(original)
  expect(store.metadata().categories.some((c) => c.id === 'groceries')).toBe(
    true,
  )
  expect(store.audit('tx_1')).toHaveLength(1)
})

it('paginates all 328 category transactions without duplicates or missing records', async () => {
  const { store } = database()
  bank(Array.from({ length: 328 }, (_, i) => tx(`category-${i}`)))
  await store.sync()
  for (let i = 0; i < 328; i++)
    store.edit(`category-${i}`, categoryDeletionEdit)
  const pages = Array.from({ length: 7 }, (_, page) =>
    store.transactions({ ...filter, category: 'groceries', page }),
  )
  expect(pages.every((p) => p.total === 328)).toBe(true)
  expect(pages[6].items).toHaveLength(28)
  expect(new Set(pages.flatMap((p) => p.items.map((t) => t.id))).size).toBe(328)
  expect(store.metadata().categoryCounts?.groceries).toBe(328)
})

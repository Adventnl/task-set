import { minorUnits } from '../../src/shared/utils/finance'
import type {
  FinanceAccount,
  FinanceTransaction,
} from '../../src/shared/types/finance'
export interface AkahuEnv {
  AI?: Env['AI']
  OPENROUTER_API_KEY?: string
  AKAHU_APP_TOKEN?: string
  AKAHU_USER_TOKEN?: string
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
  VAPID_SUBJECT?: string
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Unexpected bank response')
  return value as Record<string, unknown>
}
export function text(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('Missing bank field')
  return value
}
export function timestamp(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : null
}
export class AkahuError extends Error {
  constructor(
    readonly status: number,
    endpoint?: string,
    reason?: string,
  ) {
    super(
      (status === 401 || status === 403
        ? 'Akahu denied access. Check server credentials and Personal App permissions.'
        : status === 429
          ? 'Akahu rate limit reached. Retry later.'
          : status === 400
            ? 'Akahu rejected the request. Check Personal App token configuration and permissions.'
            : 'Akahu is unavailable or returned an invalid response.') +
        (endpoint
          ? ` Endpoint: ${endpoint}. ${reason ?? `HTTP ${status}.`}`
          : ''),
    )
  }
}
function bankEndpoint(path: string): string {
  return path.startsWith('/accounts')
    ? '/accounts'
    : path.startsWith('/transactions/pending')
      ? '/transactions/pending'
      : path.startsWith('/transactions')
        ? '/transactions'
        : path === '/refresh'
          ? '/refresh'
          : '/me'
}
export class AkahuClient {
  constructor(
    private env: AkahuEnv,
    // Native Workers fetch must not receive this client as its `this` value.
    private send: typeof fetch = (...args) => fetch(...args),
  ) {}
  async request(
    path: string,
    method = 'GET',
  ): Promise<Record<string, unknown>> {
    if (
      !/^\/(me|accounts(?:\/[^/?]+\/transactions)?|transactions(?:\/pending)?|refresh)(?:\?|$)/.test(
        path,
      ) ||
      (method !== 'GET' && !(method === 'POST' && path === '/refresh'))
    )
      throw new Error('Unsupported bank operation')
    if (!this.env.AKAHU_APP_TOKEN || !this.env.AKAHU_USER_TOKEN)
      throw new AkahuError(401)
    // Only fixed endpoint names enter diagnostics, never query strings, bank data or upstream bodies.
    const endpoint = bankEndpoint(path)
    let response: Response | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await this.send(`https://api.akahu.io/v1${path}`, {
          method,
          redirect: 'manual',
          signal: AbortSignal.timeout(25000),
          headers: {
            Authorization: `Bearer ${this.env.AKAHU_USER_TOKEN}`,
            'X-Akahu-Id': this.env.AKAHU_APP_TOKEN,
            Accept: 'application/json',
          },
        })
      } catch {
        if (method !== 'GET' || attempt === 2)
          throw new AkahuError(
            503,
            endpoint,
            'Network request failed or timed out.',
          )
      }
      if (
        (response &&
          (response.ok || ![502, 503, 504].includes(response.status))) ||
        method !== 'GET' ||
        attempt === 2
      )
        break
      await new Promise((resolve) => setTimeout(resolve, 250 * 4 ** attempt))
    }
    if (!response) throw new AkahuError(503, endpoint, 'No response received.')
    if (!response.ok) throw new AkahuError(response.status, endpoint)
    let body: Record<string, unknown>
    try {
      body = object(await response.json())
    } catch {
      throw new AkahuError(
        502,
        endpoint,
        'Response was not a valid JSON object.',
      )
    }
    if (body.success !== true)
      throw new AkahuError(502, endpoint, 'Response did not confirm success.')
    return body
  }
  async list(path: string): Promise<unknown[]> {
    const body = await this.request(path)
    if (!Array.isArray(body.items))
      throw new AkahuError(
        502,
        bankEndpoint(path),
        'Response did not contain an items array.',
      )
    return body.items
  }
  async *transactions(start: string, end: string): AsyncGenerator<unknown[]> {
    const seen = new Set<string>()
    let cursor: string | null = null
    do {
      const query = new URLSearchParams({
        start,
        end,
        ...(cursor ? { cursor } : {}),
      })
      const body = await this.request(`/transactions?${query}`)
      if (!Array.isArray(body.items))
        throw new AkahuError(
          502,
          '/transactions',
          'Response did not contain an items array.',
        )
      if (
        !body.cursor ||
        typeof body.cursor !== 'object' ||
        Array.isArray(body.cursor)
      )
        throw new AkahuError(
          502,
          '/transactions',
          'Response did not contain a pagination cursor.',
        )
      const next = object(body.cursor).next
      if (next !== null && typeof next !== 'string')
        throw new AkahuError(502, '/transactions', 'Invalid pagination cursor.')
      if (typeof next === 'string' && (!next || seen.has(next)))
        throw new AkahuError(
          502,
          '/transactions',
          'Pagination cursor was empty or repeated.',
        )
      yield body.items
      cursor = next as string | null
      if (cursor) seen.add(cursor)
    } while (cursor)
  }
}
export function bankAccount(value: unknown, now: string): FinanceAccount {
  const a = object(value),
    balance = a.balance ? object(a.balance) : {},
    refreshed = a.refreshed ? object(a.refreshed) : {},
    connection = object(a.connection)
  return {
    id: text(a._id),
    name: text(a.name),
    institution: text(connection.name),
    connection: text(connection._id),
    type: text(a.type),
    currency: typeof balance.currency === 'string' ? balance.currency : 'NZD',
    masked:
      typeof a.formatted_account === 'string'
        ? `•••• ${a.formatted_account.replace(/\D/g, '').slice(-4)}`
        : '',
    status: text(a.status),
    current: balance.current == null ? null : minorUnits(balance.current),
    available: balance.available == null ? null : minorUnits(balance.available),
    balanceAt: timestamp(refreshed.balance),
    transactionsAt: timestamp(refreshed.transactions),
    syncedAt: now,
    included: true,
    archived: false,
  }
}
export function bankTransaction(
  value: unknown,
  account: FinanceAccount,
  now: string,
  pending: boolean,
): FinanceTransaction {
  const t = object(value),
    merchant = t.merchant ? object(t.merchant) : {},
    category = t.category ? object(t.category) : {}
  const date = timestamp(t.date)
  if (!date) throw new Error('Invalid bank transaction date')
  const providerId = pending ? null : text(t._id)
  return {
    id: providerId ?? '',
    providerId,
    accountId: text(t._account),
    description: text(t.description),
    merchant:
      typeof merchant.name === 'string' ? merchant.name : text(t.description),
    amount: minorUnits(t.amount),
    currency: account.currency,
    type: text(t.type),
    date,
    providerUpdatedAt: timestamp(t.updated_at),
    balance: t.balance == null ? null : minorUnits(t.balance),
    status: pending ? 'pending' : 'settled',
    importedAt: now,
    observedAt: now,
    providerCategory: typeof category.name === 'string' ? category.name : null,
    category: 'uncategorized',
    notes: '',
    tags: [],
    review: 'needs-review',
    reviewedAt: null,
    excluded: false,
    transferId: null,
    refundId: null,
    ruleId: null,
    splits: [],
  }
}

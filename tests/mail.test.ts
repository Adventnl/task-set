import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { parseMailAccountInput, mailAccountsMatching, MAX_MAIL_ACCOUNTS } from '../src/shared/utils/mail'
import { MailStore } from '../worker/mailStore'
import { mailApi } from '../worker/mailApi'

const databases: DatabaseSync[] = []
function database() {
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  const sql = { exec(query: string, ...params: (string | number | null)[]) {
    const rows = db.prepare(query).all(...params)
    return { toArray: () => rows }
  } } as unknown as SqlStorage
  return new MailStore(sql)
}
const input = { provider: 'gmail' as const, address: 'first@example.com', label: 'Personal' }
function request(method: string, id = '', body?: unknown) {
  return new Request(`https://task.test/api/mail/accounts${id ? `/${id}` : ''}`, {
    method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  })
}
afterEach(() => { for (const db of databases.splice(0)) db.close() })

describe('mail setup validation', () => {
  it('normalizes addresses without rewriting dots or plus aliases, and accepts custom domains', () => {
    expect(parseMailAccountInput({ ...input, address: '  First.Name+work@My-Domain.nz ', label: ' Work ' })).toEqual({ ...input, address: 'first.name+work@my-domain.nz', label: 'Work' })
  })
  it.each([
    null, [], {}, { ...input, provider: 'other' }, { ...input, address: 'not an email' },
    { ...input, address: 'a@b.c\nsecret' }, { ...input, label: 'x'.repeat(81) },
    { ...input, password: 'never-store' }, { ...input, accessToken: 'never-store' },
    { ...input, status: 'connected' }, { ...input, label: 'a\u0000b' },
    { ...input, address: 'a\u0000b@example.com' },
  ])('rejects invalid or credential-bearing input: %j', (value) => {
    expect(parseMailAccountInput(value)).toBeNull()
  })
})

describe('shared mail account registry', () => {
  it('supports multiple accounts per provider, persists edits and retries idempotently', async () => {
    const store = database()
    for (const provider of ['gmail', 'proton', 'purelymail'] as const) {
      for (let i = 0; i < 2; i++) {
        const result = await mailApi(request('PUT', `${provider}-${i}`, { provider, address: `${provider}${i}@example.com`, label: '' }), store)
        expect(result.status).toBe(200)
      }
    }
    const saved = store.accounts()[0]
    await mailApi(request('PUT', saved.id, { provider: saved.provider, address: saved.address, label: 'Renamed' }), store)
    await mailApi(request('PUT', saved.id, { provider: saved.provider, address: saved.address, label: 'Renamed' }), store)
    const accounts = await (await mailApi(request('GET'), store)).json()
    expect(accounts).toHaveLength(6)
    expect(accounts[0]).toMatchObject({ ...saved, label: 'Renamed', status: 'setup-required' })
    expect(mailAccountsMatching(store.accounts(), 'RENAMED')).toHaveLength(1)
    expect(mailAccountsMatching(store.accounts(), 'proton')).toHaveLength(2)
  })
  it('refuses duplicates across providers and preserves the original on failed edits', async () => {
    const store = database()
    store.save('first', input)
    store.save('second', { ...input, address: 'second@example.com' })
    for (const id of ['second', 'third']) {
      const result = await mailApi(request('PUT', id, { ...input, provider: 'proton', address: 'FIRST@EXAMPLE.COM' }), store)
      expect(result.status).toBe(409)
    }
    expect(store.accounts()).toHaveLength(2)
    expect(store.accounts().find((account) => account.id === 'second')?.address).toBe('second@example.com')
  })
  it('bounds the registry and still allows edits at capacity', async () => {
    const store = database()
    for (let i = 0; i < MAX_MAIL_ACCOUNTS; i++) store.save(`account-${i}`, { ...input, address: `account${i}@example.com` })
    expect((await mailApi(request('PUT', 'overflow', input), store)).status).toBe(409)
    expect((await mailApi(request('PUT', 'account-0', input), store)).status).toBe(200)
  })
  it('removes setup idempotently and rejects bad bodies, credential fields, paths and methods', async () => {
    const store = database()
    await mailApi(request('PUT', 'first', input), store)
    for (let i = 0; i < 2; i++) expect((await mailApi(request('DELETE', 'first'), store)).status).toBe(200)
    expect(store.accounts()).toEqual([])
    for (const body of [{ ...input, password: 'secret' }, { ...input, label: 'x'.repeat(3000) }]) {
      expect((await mailApi(request('PUT', 'bad', body), store)).status).toBe(400)
    }
    expect((await mailApi(new Request('https://task.test/api/mail/accounts/bad', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{' }), store)).status).toBe(400)
    expect((await mailApi(request('PUT', 'bad%2Fid', input), store)).status).toBe(404)
    expect((await mailApi(request('POST', 'first', input), store)).status).toBe(405)
    expect(store.accounts()).toEqual([])
  })
})

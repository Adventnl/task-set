import { describe, expect, it, vi } from 'vitest'
import { createSessionCookie } from '../worker/auth'

vi.mock('../worker/taskSpace', () => ({ TaskSpace: class {} }))
import worker from '../worker/index'

describe('mail API access', () => {
  it('requires a session for reads and same-origin authorization for writes', async () => {
    const mailRequest = vi.fn(async () => Response.json([]))
    const env = {
      APP_PASSCODE: 'test-mail-passphrase', SESSION_SECRET: 'test-mail-secret-'.repeat(3),
      TASK_SPACE: { getByName: () => ({ mailRequest }) },
    } as unknown as Env
    const ctx = {} as ExecutionContext
    const url = 'https://task.test/api/mail/accounts/test'
    const call = (request: Request) => worker.fetch(request, env, ctx)
    expect((await call(new Request('https://task.test/api/mail/accounts'))).status).toBe(401)
    const cookie = (await createSessionCookie(env)).split(';')[0]
    for (const origin of [undefined, 'https://other.test']) {
      expect((await call(new Request(url, { method: 'PUT', headers: { Cookie: cookie, ...(origin ? { Origin: origin } : {}) } }))).status).toBe(403)
    }
    expect(mailRequest).not.toHaveBeenCalled()
    const result = await call(new Request('https://task.test/api/mail/accounts', { headers: { Cookie: cookie } }))
    expect(result.status).toBe(200)
    expect(result.headers.get('cache-control')).toContain('no-store')
    expect((await call(new Request(url, { method: 'DELETE', headers: { Cookie: cookie, Origin: 'https://task.test' } }))).status).toBe(200)
    expect(mailRequest).toHaveBeenCalledTimes(2)
  })
})

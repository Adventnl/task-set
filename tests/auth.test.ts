import { describe, expect, it } from 'vitest'
import { authConfigured, clearSessionCookie, createSessionCookie, hasSession, passcodeMatches } from '../worker/auth'

const env = { APP_PASSCODE: 'correct horse battery', SESSION_SECRET: 'x'.repeat(40) } as Env

function requestWith(setCookie: string): Request {
  return new Request('https://task.hanoryx.com/api/sync', { headers: { cookie: setCookie.split(';')[0] } })
}

describe('passcode sessions', () => {
  it('requires both secrets to be long enough', () => {
    expect(authConfigured(env)).toBe(true)
    expect(authConfigured({ ...env, APP_PASSCODE: 'short' })).toBe(false)
    expect(authConfigured({ ...env, SESSION_SECRET: '' })).toBe(false)
  })

  it('checks the passcode exactly', async () => {
    expect(await passcodeMatches('correct horse battery', env)).toBe(true)
    expect(await passcodeMatches('correct horse batter', env)).toBe(false)
    expect(await passcodeMatches('', env)).toBe(false)
  })

  it('issues an HttpOnly, Secure, SameSite=Strict cookie that verifies', async () => {
    const cookie = await createSessionCookie(env)
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/Secure/)
    expect(cookie).toMatch(/SameSite=Strict/)
    expect(await hasSession(requestWith(cookie), env)).toBe(true)
  })

  it('rejects tampered, expired, missing, and pre-rotation sessions', async () => {
    const cookie = await createSessionCookie(env)
    const [name, value] = cookie.split(';')[0].split('=')
    const [expires, signature] = value.split('.')
    expect(await hasSession(requestWith(`${name}=${Number(expires) + 1}.${signature}`), env)).toBe(false)
    expect(await hasSession(requestWith(`${name}=${expires}.${signature.slice(1)}x`), env)).toBe(false)
    expect(await hasSession(requestWith(`${name}=1.${signature}`), env)).toBe(false)
    expect(await hasSession(new Request('https://task.hanoryx.com/'), env)).toBe(false)
    expect(await hasSession(requestWith(clearSessionCookie()), env)).toBe(false)
    expect(await hasSession(requestWith(cookie), { ...env, APP_PASSCODE: 'a brand new passcode' })).toBe(false)
  })
})

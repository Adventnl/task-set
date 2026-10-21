import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSessionCookie, clearSessionCookie } from '../worker/auth'
import { privateApp, privateResponse, signIn, signInPage } from '../worker/access'

function setup() {
  const assets = vi.fn(async () => new Response('PRIVATE APP', { headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=3600' } }))
  const limit = vi.fn(async () => ({ success: true }))
  const env = { APP_PASSCODE: 'test workspace passphrase', SESSION_SECRET: 'test-session-secret-'.repeat(3), ASSETS: { fetch: assets }, AUTH_RATE_LIMIT: { limit } } as unknown as Env
  return { env, assets, limit }
}
function form(passcode: string, origin = 'https://task.test') {
  return new Request('https://task.test/sign-in', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ passcode }) })
}
afterEach(() => vi.restoreAllMocks())

describe('server-first workspace access', () => {
  it.each(['/', '/index.html', '/notes', '/assets/private.js', '/assets/private.css'])('never reaches ASSETS without a session: %s', async (path) => {
    const { env, assets } = setup()
    const response = await privateApp(new Request(`https://task.test${path}`, { headers: { Accept: 'text/html' } }), env)
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/sign-in')
    expect(assets).not.toHaveBeenCalled()
  })
  it('rejects direct bundle requests and HEAD requests without a cookie', async () => {
    const { env, assets } = setup()
    for (const method of ['GET', 'HEAD']) {
      expect((await privateApp(new Request('https://task.test/assets/private.js', { method }), env)).status).toBe(401)
    }
    expect(assets).not.toHaveBeenCalled()
  })
  it('serves an isolated sign-in document with no workspace bundles', async () => {
    const { env, assets } = setup()
    const response = await privateApp(new Request('https://task.test/sign-in'), env)
    const html = await response.text()
    expect(html).toContain('method="post" action="/sign-in"')
    expect(html).toContain('autocomplete="current-password"')
    expect(html).not.toContain('/assets/')
    expect(html).not.toContain('id="root"')
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
    expect(assets).not.toHaveBeenCalled()
  })
  it('serves only the explicit public allowlist before sign-in', async () => {
    const { env, assets } = setup()
    for (const path of ['/sign-in.css', '/sign-in.js', '/sw.js', '/manifest.webmanifest', '/icons/icon-192.png']) {
      await privateApp(new Request(`https://task.test${path}`), env)
    }
    expect(assets).toHaveBeenCalledTimes(5)
    expect((await privateApp(new Request('https://task.test/icons/private.json'), env)).status).toBe(401)
  })
  it('fails closed when authentication is missing or a cookie has been rotated', async () => {
    const { env, assets } = setup()
    const cookie = (await createSessionCookie(env)).split(';')[0]
    const request = new Request('https://task.test/', { headers: { cookie } })
    expect((await privateApp(request, { ...env, SESSION_SECRET: '' })).status).toBe(503)
    expect((await privateApp(request, { ...env, APP_PASSCODE: 'a different passphrase' })).status).toBe(401)
    expect(assets).not.toHaveBeenCalled()
  })
  it('serves the app only with a valid session and redirects signed-in visitors away from the form', async () => {
    const { env, assets } = setup()
    const cookie = (await createSessionCookie(env)).split(';')[0]
    const response = await privateApp(new Request('https://task.test/', { headers: { cookie } }), env)
    expect(await response.text()).toBe('PRIVATE APP')
    expect(assets).toHaveBeenCalledTimes(1)
    const login = await privateApp(new Request('https://task.test/sign-in', { headers: { cookie } }), env)
    expect(login.status).toBe(303)
    expect(login.headers.get('location')).toBe('/')
    expect((await privateApp(new Request('https://task.test/', { headers: { cookie: clearSessionCookie() } }), env)).status).toBe(401)
  })
  it('accepts the native form only for the correct passcode and same origin', async () => {
    const { env, assets, limit } = setup()
    const wrong = await privateApp(form('<script>bad</script>'), env)
    expect(wrong.status).toBe(401)
    expect(await wrong.text()).not.toContain('<script>bad</script>')
    expect((await privateApp(form(env.APP_PASSCODE, 'https://evil.test'), env)).status).toBe(403)
    const good = await privateApp(form(env.APP_PASSCODE), env)
    expect(good.status).toBe(303)
    expect(good.headers.get('location')).toBe('/')
    expect(good.headers.get('set-cookie')).toMatch(/HttpOnly; Secure; SameSite=Strict/)
    expect(limit).toHaveBeenCalledTimes(2)
    expect(assets).not.toHaveBeenCalled()
  })
  it('shares bounded, rate-limited checks between the JSON API and form', async () => {
    const { env, limit } = setup()
    expect((await signIn(new Request('https://task.test/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passcode: env.APP_PASSCODE }) }), env)).status).toBe(200)
    expect((await privateApp(form('x'.repeat(5000)), env)).status).toBe(401)
    limit.mockResolvedValue({ success: false })
    expect((await privateApp(form(env.APP_PASSCODE), env)).status).toBe(429)
    expect((await signIn(new Request('https://task.test/api/session', { method: 'POST' }), env)).status).toBe(429)
  })
  it('prevents private responses being cached and preserves asset headers', () => {
    const response = privateResponse(new Response('app', { headers: { 'Cache-Control': 'public', 'Content-Security-Policy': "default-src 'self'", Vary: 'Accept-Encoding' } }))
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('vary')).toBe('Accept-Encoding, Cookie')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('content-security-policy')).toBe("default-src 'self'")
    expect(privateResponse(signInPage()).headers.get('x-frame-options')).toBe('DENY')
  })
})

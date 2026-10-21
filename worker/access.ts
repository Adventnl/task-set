import { authConfigured, createSessionCookie, hasSession, passcodeMatches } from './auth'
import { json, readBody, readJson } from './http'

/** Only these public resources can load before authentication. App bundles are never public. */
const PUBLIC_ASSETS = new Set([
  '/sign-in.css', '/sign-in.js', '/sw.js', '/manifest.webmanifest', '/icon.png',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png',
])

function redirectTo(path: string, headers: Record<string, string> = {}): Response {
  return new Response(null, { status: 303, headers: { Location: path, 'Cache-Control': 'private, no-store', ...headers } })
}

export function signInPage(error = '', status = 200): Response {
  // Error strings are fixed server messages; no request values are interpolated into HTML.
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow"><title>Sign in · Task Set</title>
<link rel="icon" href="/icon.png"><link rel="stylesheet" href="/sign-in.css">
<script src="/sign-in.js" defer></script></head>
<body><main class="sign-in"><form class="sign-in-form" method="post" action="/sign-in">
<img src="/icons/icon-192.png" alt="" width="48" height="48">
<h1>Task Set</h1><p>Enter your passcode to open your private workspace.</p>
<label for="passcode">Passcode</label>
<input id="passcode" name="passcode" type="password" autocomplete="current-password" maxlength="1024" autofocus required>
${error ? `<p class="form-error" role="alert">${error}</p>` : ''}
<button type="submit">Sign in</button></form></main></body></html>`, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; worker-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  })
}

/** One rate-limited credential check for both the native login form and the JSON API. */
export async function signIn(request: Request, env: Env, form = false): Promise<Response> {
  const fail = (message: string, status: number) => form ? signInPage(message, status) : json({ error: message }, status)
  if (!authConfigured(env)) return fail('Task Set sign-in is not configured. Contact the owner.', 503)
  const { success } = await env.AUTH_RATE_LIMIT.limit({ key: request.headers.get('cf-connecting-ip') ?? 'unknown' })
  if (!success) return fail('Too many attempts. Wait a minute and try again.', 429)
  let passcode: unknown
  if (form) {
    if (!(request.headers.get('content-type') ?? '').startsWith('application/x-www-form-urlencoded')) return fail('Invalid sign-in request.', 400)
    const bytes = await readBody(request, 4096)
    passcode = bytes ? new URLSearchParams(new TextDecoder().decode(bytes)).get('passcode') : null
  } else {
    const body = await readJson(request, 2048)
    passcode = body && typeof body === 'object' && 'passcode' in body ? body.passcode : null
  }
  if (typeof passcode !== 'string' || !passcode || !(await passcodeMatches(passcode, env))) return fail('That passcode is not right.', 401)
  const headers = { 'Set-Cookie': await createSessionCookie(env) }
  return form ? redirectTo('/', headers) : json({ signedIn: true }, 200, headers)
}

/** Authentication runs before ASSETS, including direct requests to hashed JavaScript and CSS. */
export async function privateApp(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (request.method === 'POST' && url.pathname === '/sign-in') {
      if (request.headers.get('origin') !== url.origin) return signInPage('Invalid sign-in origin. Open Task Set and try again.', 403)
      return signIn(request, env, true)
    }
    return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET, HEAD' })
  }
  if (PUBLIC_ASSETS.has(url.pathname)) return env.ASSETS.fetch(request)
  if (!authConfigured(env)) return signInPage('Task Set sign-in is not configured. Contact the owner.', 503)
  const signedIn = await hasSession(request, env)
  if (url.pathname === '/sign-in') return signedIn ? redirectTo('/') : signInPage()
  if (!signedIn) {
    if (request.headers.get('sec-fetch-mode') === 'navigate' || request.headers.get('accept')?.includes('text/html')) return redirectTo('/sign-in')
    return json({ error: 'Sign in to continue.' }, 401)
  }
  return env.ASSETS.fetch(request)
}

export function privateResponse(response: Response): Response {
  if (response.status === 101) return response // Preserve the live WebSocket upgrade.
  const secured = new Response(response.body, response)
  secured.headers.set('Cache-Control', 'private, no-store')
  secured.headers.set('Vary', [response.headers.get('vary'), 'Cookie'].filter(Boolean).join(', '))
  secured.headers.set('X-Content-Type-Options', 'nosniff')
  secured.headers.set('X-Frame-Options', 'DENY')
  secured.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  secured.headers.set('Permissions-Policy', 'microphone=(self), screen-wake-lock=(self), camera=(), geolocation=(self)')
  return secured
}

const COOKIE_NAME = '__Host-task-set-session'
const SESSION_SECONDS = 400 * 24 * 60 * 60
const MIN_PASSCODE_LENGTH = 12
const MIN_SECRET_LENGTH = 32
const encoder = new TextEncoder()

function toBase64Url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null
  try {
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
    return Uint8Array.from(binary, (char) => char.charCodeAt(0))
  } catch {
    return null // not valid base64: treat as no session
  }
}

function signingKey(env: Env): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
}

/** Both secrets must be set and long enough before the API accepts any request. */
export function authConfigured(env: Env): boolean {
  return (env.APP_PASSCODE?.length ?? 0) >= MIN_PASSCODE_LENGTH && (env.SESSION_SECRET?.length ?? 0) >= MIN_SECRET_LENGTH
}

/** Compares in constant time by verifying the candidate against the expected passcode's MAC. */
export async function passcodeMatches(candidate: string, env: Env): Promise<boolean> {
  const key = await signingKey(env)
  const expected = await crypto.subtle.sign('HMAC', key, encoder.encode(`passcode:${env.APP_PASSCODE}`))
  return crypto.subtle.verify('HMAC', key, expected, encoder.encode(`passcode:${candidate}`))
}

// The passcode is part of the signed value, so changing it signs out every device.
function sessionPayload(expires: number, env: Env): Uint8Array<ArrayBuffer> {
  return encoder.encode(`session:${expires}:${env.APP_PASSCODE}`)
}

export async function createSessionCookie(env: Env): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS
  const signature = await crypto.subtle.sign('HMAC', await signingKey(env), sessionPayload(expires, env))
  return `${COOKIE_NAME}=${expires}.${toBase64Url(signature)}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`
}

export async function hasSession(request: Request, env: Env): Promise<boolean> {
  const token = (request.headers.get('cookie') ?? '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1)
  const [expiresText, signatureText] = token?.split('.') ?? []
  const expires = Number(expiresText)
  if (!Number.isSafeInteger(expires) || expires < Date.now() / 1000 || !signatureText) return false
  const signature = fromBase64Url(signatureText)
  if (!signature) return false
  return crypto.subtle.verify('HMAC', await signingKey(env), signature, sessionPayload(expires, env))
}

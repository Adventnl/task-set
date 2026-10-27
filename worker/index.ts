import { Buffer } from 'node:buffer'
import type { SyncRecord } from '../src/shared/types/sync'
import { fitsInStorage, MAX_PUSH_BYTES, parseSyncRecord } from '../src/shared/utils/records'
import { authConfigured, clearSessionCookie, hasSession } from './auth'
import { json, readBody, readJson } from './http'
import { privateApp, privateResponse, signIn } from './access'
import type { TaskSpace } from './taskSpace'
import { githubProxy, type GitHubEnv } from './github'

export { TaskSpace } from './taskSpace'

/** Task Set is a single-person workspace, so every signed-in device shares one Durable Object. */
const WORKSPACE = 'owner'
const MAX_AUDIO_BYTES = 8 * 1024 * 1024
const MAX_PUSH_RECORDS = 200
const NO_SPEECH_LIMIT = 0.6
const allowedAudio = new Set(['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg'])

async function push(request: Request, space: DurableObjectStub<TaskSpace>): Promise<Response> {
  const body = await readJson(request, MAX_PUSH_BYTES)
  const raw = body && typeof body === 'object' && 'records' in body && Array.isArray(body.records) ? body.records : null
  if (!raw || raw.length > MAX_PUSH_RECORDS) return json({ error: 'Invalid sync request' }, 400)
  // A record too large for one storage row is refused here, so it can never make the whole batch fail.
  const records = raw.map(parseSyncRecord).filter((record): record is SyncRecord => record !== null && fitsInStorage(record))
  if (records.length !== raw.length) {
    console.error(JSON.stringify({ event: 'sync_records_rejected', count: raw.length - records.length }))
  }
  const { cursor } = await space.push(records)
  return json({ cursor, rejected: raw.length - records.length })
}

async function transcribe(request: Request, env: Env): Promise<Response> {
  // Preview deployments have no Workers AI binding, and transcription has no fallback.
  if (!env.AI) return json({ error: 'Voice needs Workers AI, which this deployment does not have. You can still type.' }, 503)
  const mimeType = (request.headers.get('content-type') ?? '').split(';')[0].toLowerCase()
  if (!allowedAudio.has(mimeType)) return json({ error: 'Unsupported audio format' }, 415)
  const bytes = await readBody(request, MAX_AUDIO_BYTES)
  if (!bytes) return json({ error: 'Recording is empty or too long' }, 413)
  // The audio exists only for this request; it is never stored. Voice-activity filtering and the
  // no-speech check stop Whisper from inventing words (typically "You") for silence or noise.
  const result = await env.AI.run('@cf/openai/whisper-large-v3-turbo', {
    audio: Buffer.from(bytes).toString('base64'),
    vad_filter: true,
    condition_on_previous_text: false,
  })
  const spoken = result.segments?.filter((segment) => (segment.no_speech_prob ?? 0) < NO_SPEECH_LIMIT)
  const text = (spoken ? spoken.map((segment) => segment.text ?? '').join(' ') : result.text).replace(/\s+/g, ' ').trim()
  return text ? json({ text }) : json({ error: 'No speech was heard. Try again a little closer to the microphone.' }, 422)
}

async function readCaptureId(request: Request): Promise<string | null> {
  const body = await readJson(request, 1024)
  const captureId = body && typeof body === 'object' && 'captureId' in body ? body.captureId : null
  return typeof captureId === 'string' ? captureId : null
}

async function route(request: Request, env: Env, url: URL): Promise<Response> {
  const unsafe = request.method !== 'GET' || request.headers.get('upgrade')?.toLowerCase() === 'websocket'
  if (unsafe && request.headers.get('origin') !== url.origin) return json({ error: 'Invalid origin' }, 403)
  if (!authConfigured(env)) {
    return json({ error: 'Task Set is not set up yet: APP_PASSCODE and SESSION_SECRET are missing.' }, 500)
  }

  const endpoint = `${request.method} ${url.pathname}`
  if (endpoint === 'POST /api/session') return signIn(request, env)
  if (endpoint === 'DELETE /api/session') return json({ signedIn: false }, 200, { 'Set-Cookie': clearSessionCookie() })
  if (!(await hasSession(request, env))) return json({ error: 'Sign in to continue.' }, 401)

  if (endpoint === 'GET /api/session') return json({ signedIn: true })
  if (endpoint === 'GET /api/github') return githubProxy(request, env as Env & GitHubEnv)

  const space = env.TASK_SPACE.getByName(WORKSPACE)
  if (url.pathname === '/api/mail' || url.pathname.startsWith('/api/mail/')) return space.mailRequest(request)
  if (url.pathname === '/api/finance' || url.pathname.startsWith('/api/finance/')) {
    if (['/api/finance/insight', '/api/finance/receipt-match'].includes(url.pathname) && !(await env.AI_RATE_LIMIT.limit({ key: 'finance-insight' })).success)
      return json({ error: 'Too many merchant descriptions. Retry in a minute.' }, 429)
    const expensive = ['/api/finance/sync', '/api/finance/refresh', '/api/finance/export'].includes(url.pathname)
    if (expensive && !(await env.AUTH_RATE_LIMIT.limit({ key: 'finance-expensive' })).success) return json({ error: 'Too many finance requests. Retry in a minute.' }, 429)
    return space.financeRequest(request)
  }
  if (endpoint === 'GET /api/news' || endpoint === 'POST /api/news/refresh') {
    return json(await space.newsDigest(request.method === 'POST'))
  }
  switch (endpoint) {
    case 'GET /api/sync': {
      const since = Number(url.searchParams.get('since') ?? '0')
      if (!Number.isSafeInteger(since) || since < 0) return json({ error: 'Invalid cursor' }, 400)
      return json(await space.pull(since))
    }
    case 'POST /api/sync':
      return push(request, space)
    case 'GET /api/live':
      return space.fetch(request)
    case 'POST /api/ai/transcribe': {
      const { success } = await env.AI_RATE_LIMIT.limit({ key: 'transcribe' })
      return success ? transcribe(request, env) : json({ error: 'Too many voice notes at once. Try again in a minute.' }, 429)
    }
    case 'POST /api/ai/retry': {
      const { success } = await env.AI_RATE_LIMIT.limit({ key: 'retry' })
      if (!success) return json({ error: 'Too many retries. Try again in a minute.' }, 429)
      const captureId = await readCaptureId(request)
      if (!captureId) return json({ error: 'Invalid request' }, 400)
      return (await space.retryAi(captureId)) ? json({ queued: true }, 202) : json({ error: 'Nothing to retry' }, 409)
    }
    case 'POST /api/ai/generate': {
      const { success } = await env.AI_RATE_LIMIT.limit({ key: 'generate' })
      if (!success) return json({ error: 'Too many requests for tasks. Try again in a minute.' }, 429)
      const captureId = await readCaptureId(request)
      if (!captureId) return json({ error: 'Invalid request' }, 400)
      return (await space.generateTasks(captureId))
        ? json({ queued: true }, 202)
        : json({ error: 'This note has not reached the server yet. Try again once it has synced.' }, 409)
    }
  }
  return json({ error: 'Not found' }, 404)
}

export default {
  async scheduled(_event, env, ctx): Promise<void> {
    ctx.waitUntil(env.TASK_SPACE.getByName(WORKSPACE).newsDigest().catch(() => {
      console.error(JSON.stringify({ event: 'news_refresh_failed' }))
    }))
    if (_event.cron !== '17 */4 * * *') return
    ctx.waitUntil(env.TASK_SPACE.getByName(WORKSPACE).financeSync().catch(() => {
      console.error(JSON.stringify({ event: 'finance_sync_failed' }))
    }))
  },
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    try {
      return privateResponse(await (url.pathname.startsWith('/api/') ? route(request, env, url) : privateApp(request, env)))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(JSON.stringify({ event: 'api_failed', route: url.pathname, message }))
      return privateResponse(json({ error: 'Task Set could not finish that. Try again.' }, 500))
    }
  },
} satisfies ExportedHandler<Env>

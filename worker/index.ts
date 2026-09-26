import { Buffer } from 'node:buffer'
import type { SyncRecord } from '../src/shared/types/sync'
import { parseSyncRecord } from '../src/shared/utils/records'
import { authConfigured, clearSessionCookie, createSessionCookie, hasSession, passcodeMatches } from './auth'
import { json, readBody, readJson } from './http'
import type { TaskSpace } from './taskSpace'

export { TaskSpace } from './taskSpace'

/** Task Set is a single-person workspace, so every signed-in device shares one Durable Object. */
const WORKSPACE = 'owner'
const MAX_AUDIO_BYTES = 8 * 1024 * 1024
const MAX_PUSH_BYTES = 1024 * 1024
const MAX_PUSH_RECORDS = 200
const NO_SPEECH_LIMIT = 0.6
const allowedAudio = new Set(['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg'])

async function signIn(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
  const { success } = await env.AUTH_RATE_LIMIT.limit({ key: ip })
  if (!success) return json({ error: 'Too many attempts. Wait a minute and try again.' }, 429)
  const body = await readJson(request, 2048)
  const passcode = body && typeof body === 'object' && 'passcode' in body ? body.passcode : null
  if (typeof passcode !== 'string' || !(await passcodeMatches(passcode, env))) {
    return json({ error: 'That passcode is not right.' }, 401)
  }
  return json({ signedIn: true }, 200, { 'Set-Cookie': await createSessionCookie(env) })
}

async function push(request: Request, space: DurableObjectStub<TaskSpace>): Promise<Response> {
  const body = await readJson(request, MAX_PUSH_BYTES)
  const raw = body && typeof body === 'object' && 'records' in body && Array.isArray(body.records) ? body.records : null
  if (!raw || raw.length > MAX_PUSH_RECORDS) return json({ error: 'Invalid sync request' }, 400)
  const records = raw.map(parseSyncRecord).filter((record): record is SyncRecord => record !== null)
  if (records.length !== raw.length) {
    console.error(JSON.stringify({ event: 'sync_records_rejected', count: raw.length - records.length }))
  }
  const { cursor } = await space.push(records)
  return json({ cursor, rejected: raw.length - records.length })
}

async function transcribe(request: Request, env: Env): Promise<Response> {
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

  const space = env.TASK_SPACE.getByName(WORKSPACE)
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
      const body = await readJson(request, 1024)
      const captureId = body && typeof body === 'object' && 'captureId' in body ? body.captureId : null
      if (typeof captureId !== 'string') return json({ error: 'Invalid request' }, 400)
      return (await space.retryAi(captureId)) ? json({ queued: true }, 202) : json({ error: 'Nothing to retry' }, 409)
    }
  }
  return json({ error: 'Not found' }, 404)
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)
    try {
      return await route(request, env, url)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(JSON.stringify({ event: 'api_failed', route: url.pathname, message }))
      return json({ error: 'Task Set could not finish that. Your data on this device is safe; try again.' }, 500)
    }
  },
} satisfies ExportedHandler<Env>

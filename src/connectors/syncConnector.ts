import type { LiveMessage, PullResponse, PushRequest, SyncRecord } from '../shared/types/sync'
import { requestJson } from '../shared/utils/http'
import { parseSyncRecord } from '../shared/utils/records'

const KEEP_ALIVE_MS = 30_000

export async function createSession(passcode: string): Promise<void> {
  await requestJson('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode }),
  })
}

export async function deleteSession(): Promise<void> {
  await requestJson('/api/session', { method: 'DELETE' })
}

export async function pullRecords(since: number): Promise<PullResponse> {
  const body = await requestJson(`/api/sync?since=${since}`)
  if (!body || typeof body !== 'object' || !('records' in body) || !Array.isArray(body.records)) {
    throw new Error('The sync response was invalid.')
  }
  const cursor = 'cursor' in body ? body.cursor : null
  if (typeof cursor !== 'number' || !Number.isSafeInteger(cursor)) throw new Error('The sync response was invalid.')
  const records = body.records.map(parseSyncRecord)
  const valid = records.filter((record): record is SyncRecord => record !== null)
  if (valid.length !== records.length) {
    console.error(`Skipped ${records.length - valid.length} unreadable synced records.`)
  }
  return { records: valid, cursor, more: 'more' in body && body.more === true }
}

export async function pushRecords(records: SyncRecord[]): Promise<void> {
  await requestJson('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records } satisfies PushRequest),
  })
}

export interface LiveHandlers {
  onOpen: () => void
  onChange: (cursor: number) => void
  onClose: () => void
}

/** Opens the live-update socket. The server only sends "changed" signals; data always comes from a pull. */
export function openLiveSocket(handlers: LiveHandlers): { close: () => void } {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const socket = new WebSocket(`${protocol}//${location.host}/api/live`)
  let keepAlive: number | undefined
  socket.onopen = () => {
    keepAlive = window.setInterval(() => socket.send('ping'), KEEP_ALIVE_MS)
    handlers.onOpen()
  }
  socket.onmessage = (event) => {
    if (typeof event.data !== 'string' || event.data === 'pong') return
    try {
      const message = JSON.parse(event.data) as Partial<LiveMessage>
      if (message.type === 'changed' && typeof message.cursor === 'number') handlers.onChange(message.cursor)
    } catch {
      console.error('Ignored an unreadable live update.')
    }
  }
  socket.onclose = () => {
    window.clearInterval(keepAlive)
    handlers.onClose()
  }
  return {
    close: () => {
      socket.onclose = null
      window.clearInterval(keepAlive)
      socket.close()
    },
  }
}

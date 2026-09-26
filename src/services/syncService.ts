import { createSession, deleteSession, openLiveSocket, pullRecords, pushRecords, type LiveHandlers } from '../connectors/syncConnector'
import type { SyncOutcome, SyncRecord } from '../shared/types/sync'
import { HttpError, UnreachableError } from '../shared/utils/http'
import { acknowledgeOutbox, applyRemote, clearLocalData, countOutbox, readCursor, readOutbox } from './localDataService'

const PUSH_BATCH = 100

/** Pushes every queued local change, then pulls server changes until caught up. Never rejects. */
async function runSync(): Promise<SyncOutcome> {
  try {
    for (let entries = await readOutbox(PUSH_BATCH); entries.length; entries = await readOutbox(PUSH_BATCH)) {
      await pushRecords(entries.map((entry) => entry.record))
      await acknowledgeOutbox(entries)
    }
    const applied: SyncRecord[] = []
    let cursor = await readCursor()
    let more = true
    while (more) {
      const page = await pullRecords(cursor)
      applied.push(...(await applyRemote(page.records, page.cursor)))
      more = page.more && page.cursor > cursor
      cursor = page.cursor
    }
    return { status: 'synced', applied }
  } catch (error) {
    if (error instanceof UnreachableError) return { status: 'offline' }
    if (error instanceof HttpError && error.status === 401) return { status: 'signed-out' }
    return { status: 'error', message: error instanceof Error ? error.message : 'Sync failed.' }
  }
}

let running: Promise<SyncOutcome> | null = null
let queued: Promise<SyncOutcome> | null = null

/** Runs one sync at a time. Requests made during a run share a single follow-up run. */
export function requestSync(): Promise<SyncOutcome> {
  if (!running) {
    running = runSync().finally(() => {
      running = null
    })
    return running
  }
  queued ??= running.then(() => {
    queued = null
    return requestSync()
  })
  return queued
}

/** Signs this device in; throws with a readable message when the passcode is refused. */
export async function signIn(passcode: string): Promise<SyncOutcome> {
  await createSession(passcode)
  return requestSync()
}

/** Ends the session and removes this device's copy. Requires a connection to clear the cookie. */
export async function signOut(): Promise<void> {
  await deleteSession()
  await clearLocalData()
}

export function unsyncedChangeCount(): Promise<number> {
  return countOutbox()
}

export function connectLive(handlers: LiveHandlers): { close: () => void } {
  return openLiveSocket(handlers)
}

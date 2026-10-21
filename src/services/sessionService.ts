import { checkSession, createSession, notifySessionEnded, watchSessionEnd } from '../connectors/syncConnector'

let cleanup: Promise<void> | null = null

/** These operations never open local workspace storage or start a sync. */
export async function verifySession(): Promise<void> { await cleanup; await checkSession() }
export async function unlockWorkspace(passcode: string): Promise<void> {
  await cleanup
  await createSession(passcode)
  await verifySession()
}

export function lockWorkspace(): void { notifySessionEnded() }
export function onWorkspaceLocked(onLocked: () => void): () => void { return watchSessionEnd(onLocked) }

/** Prevent a new login racing the previous session's local cleanup. */
export async function closeWorkspace(operation: () => Promise<void>): Promise<void> {
  cleanup = operation()
  lockWorkspace()
  try { await cleanup } finally { cleanup = null }
}

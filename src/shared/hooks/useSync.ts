import { useCallback, useEffect, useRef, useState } from 'react'
import { connectLive, requestSync, signIn as signInService, signOut as signOutService, unsyncedChangeCount } from '../../services/syncService'
import type { SyncOutcome, SyncRecord, SyncStatus } from '../types/sync'

const RETRY_MS = 20_000
const MAX_RECONNECT_MS = 30_000

/**
 * Keeps this device in step with the server: syncs on start, after local edits, when the
 * network or tab comes back, and whenever the live socket reports a change elsewhere.
 */
export function useSync({ enabled, ...handlers }: { enabled: boolean; onApplied: (records: SyncRecord[]) => void; onReset: () => void }) {
  const [status, setStatus] = useState<SyncStatus>('connecting')
  const [message, setMessage] = useState('')
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  })

  const settle = useCallback((outcome: SyncOutcome) => {
    if (outcome.status === 'synced' && outcome.applied.length) handlersRef.current.onApplied(outcome.applied)
    setStatus(outcome.status)
    setMessage(outcome.status === 'error' ? outcome.message : '')
    return outcome
  }, [])

  const sync = useCallback(() => requestSync().then(settle), [settle])

  useEffect(() => {
    if (!enabled) return
    void sync()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void sync()
    }
    window.addEventListener('online', sync)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', sync)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, sync])

  // Offline or failing: try again on a timer, since a server outage fires no browser event.
  useEffect(() => {
    if (status !== 'offline' && status !== 'error') return
    const timer = window.setTimeout(() => void sync(), RETRY_MS)
    return () => window.clearTimeout(timer)
  }, [status, sync])

  // Live updates while synced, reconnecting with backoff when the socket drops.
  useEffect(() => {
    if (status !== 'synced') return
    let attempt = 0
    let timer: number | undefined
    let live: { close: () => void } | null = null
    const open = () => {
      live = connectLive({
        onOpen: () => {
          attempt = 0
        },
        onChange: () => void sync(),
        onClose: () => {
          timer = window.setTimeout(() => {
            void sync()
            open()
          }, Math.min(MAX_RECONNECT_MS, 1000 * 2 ** attempt++))
        },
      })
    }
    open()
    return () => {
      window.clearTimeout(timer)
      live?.close()
    }
  }, [status, sync])

  const signIn = useCallback(
    async (passcode: string) => {
      settle(await signInService(passcode))
    },
    [settle],
  )

  const signOut = useCallback(async () => {
    await signOutService()
    handlersRef.current.onReset()
    setStatus('signed-out')
  }, [])

  return { status, message, sync, signIn, signOut, unsyncedChangeCount }
}

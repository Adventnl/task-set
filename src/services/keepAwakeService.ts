import type { KeepAwakeStatus } from '../shared/types/keepAwake'

const STORAGE_KEY = 'task-set:keep-awake'

export function readKeepAwake(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
}

export function saveKeepAwake(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled))
}

/** Owns one screen lock, reacquiring on return and releasing even a late request on cleanup. */
export function keepScreenAwake(onStatus: (status: KeepAwakeStatus) => void): () => void {
  if (!('wakeLock' in navigator)) { onStatus('unavailable'); return () => {} }
  let active = true
  let requesting = false
  let lock: WakeLockSentinel | null = null
  const release = (sentinel: WakeLockSentinel) => {
    void sentinel.release().catch((error: unknown) => console.error('Could not release screen wake lock.', error))
  }

  async function acquire() {
    if (!active || requesting || lock) return
    if (document.visibilityState !== 'visible') { onStatus('paused'); return }
    requesting = true
    onStatus('requesting')
    try {
      const sentinel = await navigator.wakeLock.request('screen')
      if (!active || document.visibilityState !== 'visible') { release(sentinel); return }
      lock = sentinel
      sentinel.addEventListener('release', () => {
        if (lock === sentinel) {
          lock = null
          if (active) onStatus('paused')
        }
      }, { once: true })
      onStatus('active')
    } catch {
      if (active) onStatus('error')
    } finally {
      requesting = false
    }
  }

  const visible = () => {
    if (document.visibilityState === 'visible') void acquire()
    else {
      if (lock) { const sentinel = lock; lock = null; release(sentinel) }
      onStatus('paused')
    }
  }
  document.addEventListener('visibilitychange', visible)
  void acquire()
  return () => {
    active = false
    document.removeEventListener('visibilitychange', visible)
    if (lock) { release(lock); lock = null }
  }
}

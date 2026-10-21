import { useCallback, useEffect, useRef, useState } from 'react'
import { onWorkspaceLocked, unlockWorkspace, verifySession } from '../../services/sessionService'
import { HttpError } from '../utils/http'

/** Keep the private component tree unmounted until the server confirms this session. */
export function useSession() {
  const [status, setStatus] = useState<'checking' | 'signed-in' | 'signed-out' | 'error'>('checking')
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const generation = useRef(0)
  useEffect(() => {
    let active = true
    const current = ++generation.current
    setStatus('checking')
    void verifySession().then(() => { if (active && current === generation.current) setStatus('signed-in') }).catch((cause: unknown) => {
      if (!active || current !== generation.current) return
      setStatus(cause instanceof HttpError && cause.status === 401 ? 'signed-out' : 'error')
      setError(cause instanceof Error ? cause.message : 'Could not verify access. Try again.')
    })
    return () => { active = false }
  }, [revision])

  useEffect(() => {
    const stopWatching = onWorkspaceLocked(() => { generation.current++; setStatus('signed-out') })
    const hide = () => { generation.current++; setStatus('checking') }
    const restore = (event: PageTransitionEvent) => { if (event.persisted) setRevision((current) => current + 1) }
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', restore)
    return () => {
      stopWatching()
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', restore)
    }
  }, [])

  const signIn = useCallback(async (passcode: string) => {
    const current = ++generation.current
    await unlockWorkspace(passcode)
    if (current === generation.current) setStatus('signed-in')
  }, [])
  return { status, error, signIn, retry: () => setRevision((current) => current + 1) }
}

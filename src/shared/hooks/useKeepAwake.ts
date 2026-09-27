import { useEffect, useState } from 'react'
import { keepScreenAwake, readKeepAwake, saveKeepAwake } from '../../services/keepAwakeService'
import type { KeepAwakeStatus } from '../types/keepAwake'

export function useKeepAwake(signedIn: boolean) {
  const [enabled, setEnabled] = useState(readKeepAwake)
  const [status, setStatus] = useState<KeepAwakeStatus>('off')
  const [saveFailed, setSaveFailed] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    if (!enabled || !signedIn) { setStatus('off'); return }
    return keepScreenAwake(setStatus)
  }, [enabled, signedIn, revision])

  function choose(next: boolean) {
    setEnabled(next)
    try { saveKeepAwake(next); setSaveFailed(false) } catch { setSaveFailed(true) }
  }

  return { enabled, status, saveFailed, choose, retry: () => setRevision((value) => value + 1) }
}

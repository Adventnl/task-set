import { useEffect, useRef, useState } from 'react'
import { detectRegion, readRegion, saveRegion } from '../../services/locationService'
import type { NzRegion } from '../utils/nzHolidays'

export function useNzRegion() {
  const [region, setRegion] = useState(readRegion)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  function choose(value: NzRegion | null) {
    controller.current?.abort()
    setBusy(false)
    setRegion(value)
    try { saveRegion(value); setError('') } catch { setError('Region applies now, but could not be remembered on this device.') }
  }
  async function detect() {
    controller.current?.abort()
    const request = new AbortController()
    controller.current = request
    setBusy(true)
    setError('')
    try { const value = await detectRegion(request.signal); if (!request.signal.aborted) choose(value) }
    catch (cause) { if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not detect your region.') }
    finally { if (!request.signal.aborted) setBusy(false) }
  }
  return { region, choose, detect, busy, error }
}

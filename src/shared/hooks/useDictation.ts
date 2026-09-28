import { useCallback, useEffect, useRef, useState } from 'react'
import { startDictation, type Dictation } from '../../services/speechService'

export type DictationPhase = 'idle' | 'starting' | 'listening' | 'transcribing'

/** A shorter hold is taken as a slip and not sent. */
const MIN_HOLD_MS = 1_000
const TOO_SHORT = 'Recording too short. Hold for at least a second while you talk.'

/**
 * Hold-to-talk state. `onResult` receives the final text once speech ends. Finishing less than
 * `MIN_HOLD_MS` after starting cancels instead and explains why.
 */
export function useDictation(onResult: (text: string) => void) {
  const [phase, setPhase] = useState<DictationPhase>('idle')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const sessionRef = useRef<Dictation | null>(null)
  const startedAt = useRef(0)
  const resultRef = useRef(onResult)
  useEffect(() => {
    resultRef.current = onResult
  })

  const reset = useCallback(() => {
    sessionRef.current = null
    setPhase('idle')
    setTranscript('')
  }, [])

  const start = useCallback(() => {
    if (sessionRef.current) return
    setError('')
    setTranscript('')
    setPhase('starting')
    startedAt.current = performance.now()
    sessionRef.current = startDictation({
      onListening: () => setPhase('listening'),
      onTranscript: setTranscript,
      onTranscribing: () => setPhase('transcribing'),
      onResult: (text) => {
        reset()
        resultRef.current(text)
      },
      onError: (message) => {
        reset()
        setError(message)
      },
    })
  }, [reset])

  const cancel = useCallback(() => {
    sessionRef.current?.cancel()
    reset()
  }, [reset])

  const finish = useCallback(() => {
    if (!sessionRef.current) return
    if (performance.now() - startedAt.current >= MIN_HOLD_MS) return sessionRef.current.finish()
    cancel()
    setError(TOO_SHORT)
  }, [cancel])

  useEffect(() => () => sessionRef.current?.cancel(), [])

  return { phase, transcript, error, start, finish, cancel, dismissError: () => setError('') }
}

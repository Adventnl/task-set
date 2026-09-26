import { useCallback, useEffect, useRef, useState } from 'react'
import { startDictation, type Dictation } from '../../services/speechService'

export type DictationPhase = 'idle' | 'starting' | 'listening' | 'transcribing'

/** Hold-to-talk state. `onResult` receives the final text once speech ends. */
export function useDictation(onResult: (text: string) => void) {
  const [phase, setPhase] = useState<DictationPhase>('idle')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const sessionRef = useRef<Dictation | null>(null)
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

  const finish = useCallback(() => sessionRef.current?.finish(), [])

  const cancel = useCallback(() => {
    sessionRef.current?.cancel()
    reset()
  }, [reset])

  useEffect(() => () => sessionRef.current?.cancel(), [])

  return { phase, transcript, error, start, finish, cancel, dismissError: () => setError('') }
}

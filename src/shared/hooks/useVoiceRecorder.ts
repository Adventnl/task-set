import { useEffect, useRef, useState } from 'react'

type Phase = 'idle' | 'requesting' | 'recording' | 'saving'
const MAX_RECORDING_MS = 90_000
const preferredTypes = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm']

export function useVoiceRecorder(onRecording: (audio: Blob) => Promise<void>) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const phaseRef = useRef<Phase>('idle')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const releaseRequestedRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const mountedRef = useRef(true)
  const callbackRef = useRef(onRecording)
  callbackRef.current = onRecording

  function setRecordingPhase(next: Phase) {
    phaseRef.current = next
    setPhase(next)
  }

  function stop() {
    if (phaseRef.current === 'requesting') {
      releaseRequestedRef.current = true
      return
    }
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  async function start() {
    if (phaseRef.current !== 'idle') return
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setError('Voice recording is not available in this browser.')
      return
    }
    releaseRequestedRef.current = false
    setError('')
    setRecordingPhase('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      const mimeType = preferredTypes.find((type) =>
        MediaRecorder.isTypeSupported(type),
      )
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      )
      recorderRef.current = recorder
      const chunks: BlobPart[] = []
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data)
      }
      recorder.onerror = () => setError('Recording failed. Please try again.')
      recorder.onstop = () => {
        if (timerRef.current !== null) window.clearTimeout(timerRef.current)
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        recorderRef.current = null
        const audio = new Blob(chunks, {
          type: recorder.mimeType || mimeType || 'audio/webm',
        })
        if (!audio.size) {
          setRecordingPhase('idle')
          setError('No audio was captured. Hold the button a little longer.')
          return
        }
        setRecordingPhase('saving')
        void callbackRef
          .current(audio)
          .catch(() =>
            setError(
              'Could not save this recording. Try saving it from the Feed.',
            ),
          )
          .finally(() => setRecordingPhase('idle'))
      }
      recorder.start()
      setRecordingPhase('recording')
      timerRef.current = window.setTimeout(stop, MAX_RECORDING_MS)
      if (releaseRequestedRef.current) stop()
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setRecordingPhase('idle')
      setError('Microphone access was denied or the recorder could not start.')
    }
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  return { phase, error, start, stop }
}

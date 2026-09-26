import { transcribeAudio } from '../connectors/aiConnector'
import { hasLiveRecognition, startRecognition, startRecording, type CaptureSession } from '../connectors/speechConnector'
import { UnreachableError } from '../shared/utils/http'

const MAX_DICTATION_MS = 120_000
const NOTHING_HEARD = 'Didn’t catch that. Hold the button and speak.'

export interface DictationHandlers {
  onListening: () => void
  /** Live words while speaking; only browsers with live recognition call this. */
  onTranscript: (text: string) => void
  /** The fallback path is turning the in-memory recording into text. */
  onTranscribing: () => void
  onResult: (text: string) => void
  onError: (message: string) => void
}

export interface Dictation {
  finish: () => void
  cancel: () => void
}

function recognitionMessage(code: string): string {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'Allow microphone access to talk to Task Set.'
  if (code === 'network') return 'Voice needs an internet connection. You can still type.'
  if (code === 'audio-capture') return 'No microphone was found.'
  return 'Voice stopped unexpectedly. Try again or type instead.'
}

/**
 * Turns speech into text. Uses the browser's live recognition when present; otherwise records
 * into memory, transcribes once on the server, and discards the audio. No audio is ever stored.
 */
export function startDictation(handlers: DictationHandlers): Dictation {
  let session: CaptureSession | null = null
  let requested: 'finish' | 'cancel' | null = null
  const limit = window.setTimeout(() => dictation.finish(), MAX_DICTATION_MS)
  const fail = (message: string) => {
    window.clearTimeout(limit)
    handlers.onError(message)
  }
  const succeed = (text: string) => {
    window.clearTimeout(limit)
    if (text) handlers.onResult(text)
    else handlers.onError(NOTHING_HEARD)
  }

  const dictation: Dictation = {
    finish: () => (session ? session.stop() : (requested = 'finish')),
    cancel: () => {
      window.clearTimeout(limit)
      if (session) session.abort()
      else requested = 'cancel'
    },
  }

  if (hasLiveRecognition()) {
    try {
      session = startRecognition({
        onListening: handlers.onListening,
        onTranscript: handlers.onTranscript,
        onDone: succeed,
        onError: (code) => fail(recognitionMessage(code)),
      })
    } catch {
      fail(recognitionMessage('unknown'))
    }
    return dictation
  }

  startRecording({
    onListening: handlers.onListening,
    onDone: (audio) => {
      if (!audio) return succeed('')
      handlers.onTranscribing()
      transcribeAudio(audio).then(succeed, (error: unknown) =>
        fail(error instanceof UnreachableError ? 'Voice needs an internet connection in this browser. You can still type.' : error instanceof Error ? error.message : 'Could not turn that into text.'),
      )
    },
  }).then(
    (started) => {
      session = started
      if (requested === 'finish') started.stop()
      if (requested === 'cancel') started.abort()
    },
    (error: unknown) => fail(recognitionMessage(error instanceof DOMException && error.name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture')),
  )
  return dictation
}

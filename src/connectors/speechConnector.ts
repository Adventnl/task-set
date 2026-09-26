// Browser speech and microphone access. The Web Speech API is not in TypeScript's DOM library,
// so its shape is declared here, at the only place that touches it.

interface RecognitionResultEvent {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onresult: ((event: RecognitionResultEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

type RecognitionConstructor = new () => Recognition

export interface CaptureSession {
  stop: () => void
  abort: () => void
}

function recognitionConstructor(): RecognitionConstructor | null {
  const scope = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null
}

const join = (...parts: string[]) => parts.map((part) => part.trim()).filter(Boolean).join(' ')

export function hasLiveRecognition(): boolean {
  return recognitionConstructor() !== null
}

/**
 * Live speech-to-text. Browsers stop listening after a pause, so recognition restarts until
 * `stop` is called; `onDone` then receives everything heard. `onError` receives the API error code.
 */
export function startRecognition(handlers: {
  onListening: () => void
  onTranscript: (text: string) => void
  onDone: (text: string) => void
  onError: (code: string) => void
}): CaptureSession {
  const Recognition = recognitionConstructor()
  if (!Recognition) throw new Error('Speech recognition is unavailable.')
  // Android Chrome repeats earlier words in continuous mode; short sessions restarted in a loop avoid that.
  const continuous = !/Android/i.test(navigator.userAgent)
  let heard = ''
  let interim = ''
  let active = true
  let ended = false
  let recognition: Recognition

  const begin = () => {
    recognition = new Recognition()
    recognition.lang = navigator.language || 'en-US'
    recognition.continuous = continuous
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.onstart = handlers.onListening
    recognition.onresult = (event) => {
      interim = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        if (result.isFinal) heard = join(heard, result[0].transcript)
        else interim = join(interim, result[0].transcript)
      }
      handlers.onTranscript(join(heard, interim))
    }
    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return
      active = false
      ended = true
      handlers.onError(event.error)
    }
    recognition.onend = () => {
      if (active) return begin()
      if (ended) return
      ended = true
      handlers.onDone(join(heard, interim))
    }
    recognition.start()
  }

  begin()
  return {
    stop: () => {
      active = false
      recognition.stop()
    },
    abort: () => {
      active = false
      ended = true
      recognition.abort()
    },
  }
}

const RECORDING_TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus']

/**
 * Records into memory for browsers without live recognition. The audio is handed to `onDone`
 * once and never written anywhere. Rejects when the microphone cannot be opened.
 */
export async function startRecording(handlers: { onListening: () => void; onDone: (audio: Blob | null) => void }): Promise<CaptureSession> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('audio-capture')
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mimeType = RECORDING_TYPES.find((type) => MediaRecorder.isTypeSupported(type))
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: Blob[] = []
  let discarded = false
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data)
  }
  recorder.onstop = () => {
    stream.getTracks().forEach((track) => track.stop())
    if (discarded) return
    const audio = new Blob(chunks, { type: (recorder.mimeType || mimeType || 'audio/webm').split(';')[0] })
    handlers.onDone(audio.size ? audio : null)
  }
  recorder.start()
  handlers.onListening()
  const finish = () => {
    if (recorder.state !== 'inactive') recorder.stop()
  }
  return {
    stop: finish,
    abort: () => {
      discarded = true
      finish()
    },
  }
}

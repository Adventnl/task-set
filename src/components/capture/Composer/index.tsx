import { ArrowUp, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useState, type RefObject } from 'react'
import type { useDictation } from '../../../shared/hooks/useDictation'
import TalkButton from '../TalkButton'

const MAX_INPUT_HEIGHT = 200

type Phase = ReturnType<typeof useDictation>['phase']

const placeholders: Record<Phase, string> = {
  idle: '',
  starting: 'Starting…',
  listening: 'Listening…',
  transcribing: 'Transcribing…',
}

function talkHint(phase: Phase, handsFree: boolean): string {
  if (phase === 'starting') return 'Allow the microphone if your browser asks.'
  if (phase === 'transcribing') return 'Turning your voice into text.'
  return handsFree ? 'Tap the square to send, or × to cancel.' : 'Release to send.'
}

/**
 * Type or talk. Enter sends; the microphone sends what it hears when you let go.
 * While `hidden`, it keeps the unsent draft and never leaves the microphone listening.
 */
export default function Composer({
  inputRef,
  dictation,
  hidden = false,
  onSend,
}: {
  inputRef: RefObject<HTMLTextAreaElement | null>
  dictation: ReturnType<typeof useDictation>
  hidden?: boolean
  onSend: (text: string) => Promise<boolean>
}) {
  const [draft, setDraft] = useState('')
  const [handsFree, setHandsFree] = useState(false)
  const talking = dictation.phase !== 'idle'
  const { cancel } = dictation

  useEffect(() => {
    if (hidden) cancel()
  }, [hidden, cancel])

  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, MAX_INPUT_HEIGHT)}px`
  }, [draft, talking, inputRef])

  async function send() {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    if (!(await onSend(text))) setDraft((current) => (current ? `${text}\n${current}` : text))
  }

  return (
    <div className="composer-dock" hidden={hidden}>
      {dictation.error && (
        <p className="composer-error" role="alert">
          {dictation.error}
          <button className="link-button" type="button" onClick={dictation.dismissError}>
            Dismiss
          </button>
        </p>
      )}
      <div className={`composer${talking ? ' is-talking' : ''}`}>
        {talking ? (
          <div className="dictation">
            <button className="icon-button" type="button" onClick={dictation.cancel} aria-label="Cancel voice message">
              <X size={18} />
            </button>
            <p className="dictation-text" aria-live="polite">
              {dictation.transcript || <span className="dictation-placeholder">{placeholders[dictation.phase]}</span>}
            </p>
          </div>
        ) : (
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                void send()
              }
            }}
            placeholder="Type a thought, or hold the mic to talk"
            aria-label="New message"
            enterKeyHint="send"
          />
        )}
        {draft.trim() && !talking ? (
          <button className="send-button" type="button" onClick={() => void send()} aria-label="Send">
            <ArrowUp size={20} strokeWidth={2.2} />
          </button>
        ) : (
          <TalkButton
            phase={dictation.phase}
            onStart={() => {
              setHandsFree(false)
              dictation.start()
            }}
            onFinish={dictation.finish}
            onHandsFree={() => setHandsFree(true)}
          />
        )}
      </div>
      <p className="composer-hint">
        {talking ? (
          talkHint(dictation.phase, handsFree)
        ) : (
          <>
            <span className="hint-fine">Enter to send · Shift+Enter for a new line · Hold the mic to talk</span>
            <span className="hint-coarse">Hold the mic to talk, or tap it to talk hands-free</span>
          </>
        )}
      </p>
    </div>
  )
}

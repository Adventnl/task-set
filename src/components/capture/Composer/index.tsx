import { ArrowUp, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useState, type RefObject } from 'react'
import type { useDictation } from '../../../shared/hooks/useDictation'
import { MAX_CAPTURE_LENGTH } from '../../../shared/utils/records'
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
 * Write or talk. Enter sends and Shift+Enter adds a line; the microphone sends what it hears when
 * you let go, or keeps listening hands-free after a tap. `placeholder` and `label` say where the
 * words go: a new note, a calendar day, or a meeting.
 * While `hidden`, it keeps the unsent draft and never leaves the microphone listening.
 */
export default function Composer({
  inputRef,
  dictation,
  placeholder,
  label,
  hidden = false,
  onSend,
}: {
  inputRef: RefObject<HTMLTextAreaElement | null>
  dictation: ReturnType<typeof useDictation>
  placeholder: string
  label: string
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
            placeholder={placeholder}
            aria-label={label}
            maxLength={MAX_CAPTURE_LENGTH}
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
      {talking && <p className="composer-hint">{talkHint(dictation.phase, handsFree)}</p>}
    </div>
  )
}

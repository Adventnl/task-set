import { ArrowUp, Keyboard, Mic } from 'lucide-react'
import { useEffect, useLayoutEffect, useState, type RefObject } from 'react'
import type { useDictation } from '../../../shared/hooks/useDictation'
import { MAX_CAPTURE_LENGTH } from '../../../shared/utils/records'
import TalkButton from '../TalkButton'

const MAX_INPUT_HEIGHT = 200

type Phase = ReturnType<typeof useDictation>['phase']
type Mode = 'keyboard' | 'voice'

const placeholders: Record<Phase, string> = {
  idle: '',
  starting: 'Starting…',
  listening: 'Listening…',
  transcribing: 'Transcribing…',
}

function recordingHint(phase: Phase, cancelling: boolean): string {
  if (cancelling) return 'Release to cancel'
  if (phase === 'starting') return 'Allow the microphone if your browser asks.'
  if (phase === 'transcribing') return 'Turning your voice into text.'
  return 'Release to send · Slide up to cancel'
}

/**
 * Write or talk, switched by the button beside the box. Typing: Enter sends and Shift+Enter adds a
 * line. Voice: hold the bar to record and release to send; slide up first to cancel. `placeholder`
 * and `label` say where the words go: a new note, a calendar day, or a meeting.
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
  const [mode, setMode] = useState<Mode>('keyboard')
  const [cancelling, setCancelling] = useState(false)
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
  }, [draft, mode, inputRef])

  async function send() {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    if (!(await onSend(text))) setDraft((current) => (current ? `${text}\n${current}` : text))
  }

  /** Typing opens the keyboard straight away, as in a chat app. */
  function switchMode() {
    const next = mode === 'keyboard' ? 'voice' : 'keyboard'
    setMode(next)
    if (next === 'keyboard') requestAnimationFrame(() => inputRef.current?.focus())
  }

  return (
    <div className="composer-dock" hidden={hidden}>
      {talking && (
        <div className={`recording${cancelling ? ' is-cancelling' : ''}`}>
          <p className="recording-text" aria-live="polite">
            {dictation.transcript || <span className="recording-placeholder">{placeholders[dictation.phase]}</span>}
          </p>
          <p className="recording-hint">{recordingHint(dictation.phase, cancelling)}</p>
        </div>
      )}
      {dictation.error && (
        <p className="composer-error" role="alert">
          {dictation.error}
          <button className="link-button" type="button" onClick={dictation.dismissError}>
            Dismiss
          </button>
        </p>
      )}
      <div className={`composer${talking ? ' is-talking' : ''}`}>
        <button
          className="icon-button composer-mode"
          type="button"
          onClick={switchMode}
          disabled={talking}
          aria-label={mode === 'keyboard' ? 'Switch to voice' : 'Switch to typing'}
          title={mode === 'keyboard' ? 'Switch to voice' : 'Switch to typing'}
        >
          {mode === 'keyboard' ? <Mic size={20} /> : <Keyboard size={20} />}
        </button>
        {mode === 'voice' ? (
          <TalkButton
            phase={dictation.phase}
            cancelling={cancelling}
            onStart={dictation.start}
            onFinish={dictation.finish}
            onCancel={dictation.cancel}
            onCancellingChange={setCancelling}
          />
        ) : (
          <>
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
            {draft.trim() && (
              <button className="send-button" type="button" onClick={() => void send()} aria-label="Send">
                <ArrowUp size={20} strokeWidth={2.2} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

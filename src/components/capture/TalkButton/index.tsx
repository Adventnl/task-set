import { LoaderCircle, Mic, Square } from 'lucide-react'
import { useRef } from 'react'
import type { DictationPhase } from '../../../shared/hooks/useDictation'

/** Shorter presses count as a tap and keep listening hands-free until the next tap. */
const TAP_MS = 300

/**
 * Press and hold to talk; release to send. A quick tap starts hands-free listening instead.
 * With a keyboard, Space or Enter starts listening and pressing again sends.
 */
export default function TalkButton({
  phase,
  onStart,
  onFinish,
  onHandsFree,
}: {
  phase: DictationPhase
  onStart: () => void
  onFinish: () => void
  onHandsFree: () => void
}) {
  const pressedAt = useRef<number | null>(null)
  const active = phase !== 'idle'

  return (
    <button
      className={`talk-button${active ? ' is-active' : ''}`}
      type="button"
      aria-label={active ? 'Stop and send' : 'Hold to talk'}
      aria-pressed={active}
      disabled={phase === 'transcribing'}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        if (active) {
          pressedAt.current = null
          onFinish()
          return
        }
        pressedAt.current = event.timeStamp
        onStart()
      }}
      onPointerUp={(event) => {
        if (pressedAt.current === null) return
        const held = event.timeStamp - pressedAt.current
        pressedAt.current = null
        if (held < TAP_MS) onHandsFree()
        else onFinish()
      }}
      onPointerCancel={() => {
        if (pressedAt.current === null) return
        pressedAt.current = null
        onFinish()
      }}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if ((event.key !== 'Enter' && event.key !== ' ') || event.repeat) return
        event.preventDefault()
        if (active) return onFinish()
        onStart()
        onHandsFree()
      }}
    >
      {phase === 'transcribing' ? (
        <LoaderCircle className="spin" size={20} aria-hidden="true" />
      ) : active ? (
        <Square size={14} fill="currentColor" aria-hidden="true" />
      ) : (
        <Mic size={20} aria-hidden="true" />
      )}
    </button>
  )
}

import { LoaderCircle } from 'lucide-react'
import { useRef, type KeyboardEvent } from 'react'
import type { DictationPhase } from '../../../shared/hooks/useDictation'

/** Sliding a finger this far above the bar while holding marks the recording for cancelling. */
const CANCEL_DISTANCE = 48

const isHoldKey = (event: KeyboardEvent) => event.key === ' ' || event.key === 'Enter'

/**
 * The voice composer's wide bar: hold to record, release to send, or slide up and release to
 * cancel. With a keyboard, hold Space or Enter; Escape cancels.
 */
export default function TalkButton({
  phase,
  cancelling,
  onStart,
  onFinish,
  onCancel,
  onCancellingChange,
}: {
  phase: DictationPhase
  cancelling: boolean
  onStart: () => void
  onFinish: () => void
  onCancel: () => void
  onCancellingChange: (cancelling: boolean) => void
}) {
  const holding = useRef(false)
  const active = phase !== 'idle'

  function press() {
    holding.current = true
    onCancellingChange(false)
    onStart()
  }

  function release(send: boolean) {
    if (!holding.current) return
    holding.current = false
    onCancellingChange(false)
    if (send) onFinish()
    else onCancel()
  }

  return (
    <button
      className={`talk-bar${active ? ' is-active' : ''}${cancelling ? ' is-cancelling' : ''}`}
      type="button"
      disabled={phase === 'transcribing'}
      onPointerDown={(event) => {
        if ((event.pointerType === 'mouse' && event.button !== 0) || holding.current) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        press()
      }}
      onPointerMove={(event) => {
        if (holding.current) onCancellingChange(event.clientY < event.currentTarget.getBoundingClientRect().top - CANCEL_DISTANCE)
      }}
      onPointerUp={() => release(!cancelling)}
      // The system took the touch, for example for a call or a permission prompt: never send half a message.
      onPointerCancel={() => release(false)}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') return release(false)
        if (!isHoldKey(event)) return
        event.preventDefault()
        if (!event.repeat && !holding.current) press()
      }}
      onKeyUp={(event) => {
        if (!isHoldKey(event)) return
        event.preventDefault()
        release(true)
      }}
      onBlur={() => release(false)}
    >
      {phase === 'transcribing' ? (
        <>
          <LoaderCircle className="spin" size={18} aria-hidden="true" /> Transcribing…
        </>
      ) : !active ? (
        'Hold to talk'
      ) : cancelling ? (
        'Release to cancel'
      ) : (
        'Release to send'
      )}
    </button>
  )
}

import { ArrowUp, Mic } from 'lucide-react'
import type { useTaskSet } from '../../../shared/hooks/useTaskSet'

export default function CaptureComposer({
  model,
}: {
  model: ReturnType<typeof useTaskSet>
}) {
  const { composer, setComposer, composerRef, voice, loading, sendCapture } =
    model
  return (
    <div className="composer-wrap">
      <div className="composer-box">
        <textarea
          ref={composerRef}
          rows={1}
          value={composer}
          onChange={(event) => setComposer(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault()
              void sendCapture()
            }
          }}
          placeholder="Write a thought, task, or anything…"
          aria-label="New capture"
        />
        <div className="composer-controls">
          <span className="composer-hint">
            Enter to send <span>·</span> Shift + Enter for a new line
          </span>
          <div className="composer-buttons">
            <button
              className={`record-button ${voice.phase === 'recording' ? 'is-recording' : ''}`}
              type="button"
              disabled={loading || voice.phase === 'saving'}
              aria-label={
                voice.phase === 'recording'
                  ? 'Recording; release to save'
                  : 'Hold to record voice'
              }
              title="Hold to record voice"
              onPointerDown={(event) => {
                if (event.pointerType === 'mouse' && event.button !== 0) return
                event.currentTarget.setPointerCapture(event.pointerId)
                void voice.start()
              }}
              onPointerUp={() => voice.stop()}
              onPointerCancel={() => voice.stop()}
              onKeyDown={(event) => {
                if (
                  (event.key === ' ' || event.key === 'Enter') &&
                  !event.repeat
                ) {
                  event.preventDefault()
                  void voice.start()
                }
              }}
              onKeyUp={(event) => {
                if (event.key === ' ' || event.key === 'Enter') {
                  event.preventDefault()
                  voice.stop()
                }
              }}
              onClick={(event) => {
                if (event.detail === 0) {
                  if (voice.phase === 'recording') voice.stop()
                  else void voice.start()
                }
              }}
            >
              <Mic size={18} />
            </button>
            <button
              className="send-button"
              type="button"
              onClick={() => void sendCapture()}
              disabled={!composer.trim() || loading}
              aria-label="Save capture"
            >
              <ArrowUp size={19} strokeWidth={2.1} />
            </button>
          </div>
        </div>
      </div>
      <div className="composer-foot">
        <span>
          {voice.error ||
            (voice.phase === 'requesting'
              ? 'Allow microphone access…'
              : voice.phase === 'recording'
                ? 'Recording · release to save'
                : voice.phase === 'saving'
                  ? 'Saving recording…'
                  : 'Only in this browser for now')}
        </span>
        <span>⌘N to capture</span>
      </div>
    </div>
  )
}

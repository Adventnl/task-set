import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import type { CaptureDay } from '../../../shared/utils/taskView'
import CaptureRow, { type CaptureActions } from '../CaptureRow'

const STICK_DISTANCE = 160

/** Notes in the order they were written. Keeps the newest note in view unless the reader has scrolled back. */
export default function CaptureFeed({
  days,
  search,
  selectedIds,
  scrollRef,
  actions,
}: {
  days: CaptureDay[]
  search: string
  /** Null unless messages are being selected. */
  selectedIds: ReadonlySet<string> | null
  scrollRef: RefObject<HTMLDivElement | null>
  actions: CaptureActions
}) {
  const endRef = useRef<HTMLDivElement>(null)
  const nearEnd = useRef(true)
  const last = days.at(-1)?.captures.at(-1)
  // Task changes never alter or scroll the note.
  const tailKey = last?.id ?? ''

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const onScroll = () => {
      nearEnd.current = container.scrollHeight - container.scrollTop - container.clientHeight < STICK_DISTANCE
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [scrollRef])

  useLayoutEffect(() => {
    // A note just written on this device (not yet synced) always scrolls into view.
    if (!search && (nearEnd.current || last?.ai === null)) endRef.current?.scrollIntoView({ block: 'end' })
  }, [tailKey, search])

  if (!days.length) {
    return (
      <div className="empty-state">
        <h2>{search ? `Nothing matches “${search}”` : 'A blank page'}</h2>
        <p>
          {search
            ? 'Try another word from a note or task.'
            : 'Write a note below, or hold the microphone and talk. Notes stay as written. Say “generate task” to create work, or use a note’s ⋯ menu.'}
        </p>
      </div>
    )
  }

  return (
    <div className="feed">
      {days.map((day) => (
        <section key={day.key} className="feed-day">
          <h2 className="day-label">{day.label}</h2>
          {day.captures.map((capture) => (
            <CaptureRow
              key={capture.id}
              capture={capture}
              selected={selectedIds ? selectedIds.has(capture.id) : null}
              actions={actions}
            />
          ))}
        </section>
      ))}
      <div ref={endRef} className="feed-end" />
    </div>
  )
}

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import type { Task } from '../../../shared/types/task'
import type { CaptureDay } from '../../../shared/utils/taskView'
import CaptureRow, { type CaptureActions } from '../CaptureRow'

const STICK_DISTANCE = 160

/** The chronological Feed. Keeps the newest message in view unless the reader has scrolled back. */
export default function CaptureFeed({
  days,
  tasksByCapture,
  search,
  scrollRef,
  actions,
}: {
  days: CaptureDay[]
  tasksByCapture: Map<string, Task[]>
  search: string
  scrollRef: RefObject<HTMLDivElement | null>
  actions: CaptureActions
}) {
  const endRef = useRef<HTMLDivElement>(null)
  const nearEnd = useRef(true)
  const last = days.at(-1)?.captures.at(-1)
  // Changes when the newest message, its AI state, or its tasks change.
  const tailKey = last ? `${last.id}:${last.ai}:${tasksByCapture.get(last.id)?.length ?? 0}` : ''

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
    // A message just written on this device (not yet synced) always scrolls into view.
    if (!search && (nearEnd.current || last?.ai === null)) endRef.current?.scrollIntoView({ block: 'end' })
  }, [tailKey, search, last?.ai])

  if (!days.length) {
    return (
      <div className="empty-state">
        <h2>{search ? `Nothing matches “${search}”` : 'Say it or type it'}</h2>
        <p>
          {search
            ? 'Try another word from a message or task.'
            : 'Hold the microphone and talk, or type below. Task Set suggests tasks from what you say, and you decide what to keep.'}
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
            <CaptureRow key={capture.id} capture={capture} tasks={tasksByCapture.get(capture.id) ?? []} actions={actions} />
          ))}
        </section>
      ))}
      <div ref={endRef} className="feed-end" />
    </div>
  )
}

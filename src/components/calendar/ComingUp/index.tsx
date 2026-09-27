import type { UpcomingEvent } from '../../../shared/utils/calendarView'
import { countdownLabel, shortDayLabel } from '../../../shared/utils/dates'

/** The next few calendar events, counting down, above Notes. Each opens its day in the calendar. */
export default function ComingUp({ items, onOpen }: { items: UpcomingEvent[]; onOpen: (date: string) => void }) {
  return (
    <section className="coming-up" aria-label="Coming up">
      {items.map(({ event, days }) => (
        <button
          key={event.id}
          className={`coming-up-item${days === 0 ? ' is-today' : ''}`}
          type="button"
          title={`${shortDayLabel(event.date)}: ${event.text}`}
          onClick={() => onOpen(event.date)}
        >
          <span className="coming-up-when">{countdownLabel(days)}</span>
          <span className="coming-up-text">{event.text}</span>
        </button>
      ))}
    </section>
  )
}

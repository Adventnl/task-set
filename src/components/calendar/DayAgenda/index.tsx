import { CalendarCheck, ChevronRight, Users } from 'lucide-react'
import type { Task } from '../../../shared/types/task'
import type { CalendarItem } from '../../../shared/utils/calendarView'
import { countdownLabel, daysBetween, longDayLabel, timeOfDayLabel } from '../../../shared/utils/dates'
import { plural } from '../../../shared/utils/taskView'
import TaskRow from '../../task/TaskRow'

function meetingMeta(item: Extract<CalendarItem, { kind: 'meeting' }>): string {
  const parts: string[] = []
  if (item.meeting.time) parts.push(timeOfDayLabel(item.meeting.time))
  if (item.noteCount) parts.push(plural(item.noteCount, 'note'))
  return parts.join(' · ') || 'Meeting'
}

/**
 * Everything on the selected day: events open their editor, meetings open that meeting day, and
 * tasks can be completed or edited in place.
 */
export default function DayAgenda({
  date,
  today,
  items,
  onEditEvent,
  onOpenMeeting,
  onToggleTask,
  onEditTask,
}: {
  date: string
  today: string
  items: CalendarItem[]
  onEditEvent: (id: string) => void
  onOpenMeeting: (id: string, date: string) => void
  onToggleTask: (task: Task) => void
  onEditTask: (task: Task) => void
}) {
  const days = daysBetween(today, date)
  return (
    <section className="agenda" aria-labelledby="agenda-title">
      <div className="agenda-head">
        <h2 id="agenda-title" className="agenda-title">
          {longDayLabel(date, today)}
        </h2>
        <p className={`agenda-when${days >= 0 ? ' is-ahead' : ''}`}>{countdownLabel(days)}</p>
      </div>
      {items.length ? (
        <ul className="agenda-list">
          {items.map((item) => (
            <li key={item.id}>
              {item.kind === 'event' ? (
                <button className="agenda-row agenda-event" type="button" onClick={() => onEditEvent(item.event.id)} aria-label={`Edit “${item.event.text}”`}>
                  <CalendarCheck className="agenda-icon" size={17} aria-hidden="true" />
                  <span className="agenda-text">{item.event.text}</span>
                </button>
              ) : item.kind === 'meeting' ? (
                <button className="agenda-row" type="button" onClick={() => onOpenMeeting(item.meeting.id, item.date)}>
                  <Users className="agenda-icon" size={17} aria-hidden="true" />
                  <span className="agenda-body">
                    <span className="agenda-text">{item.meeting.title}</span>
                    <span className="agenda-meta">{meetingMeta(item)}</span>
                  </span>
                  <ChevronRight className="agenda-chevron" size={17} aria-hidden="true" />
                </button>
              ) : (
                <TaskRow task={item.task} onToggle={onToggleTask} onEdit={onEditTask} />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="agenda-empty">Nothing on this day. Type or talk below to add something.</p>
      )}
    </section>
  )
}

import { ChevronRight, Plus, Trash2 } from 'lucide-react'
import type { Meeting } from '../../../shared/types/meeting'
import { countdownLabel, daysBetween } from '../../../shared/utils/dates'
import { scheduleLabel, type MeetingSection } from '../../../shared/utils/meetingView'
import { plural } from '../../../shared/utils/taskView'

/** Meetings, soonest first, each with when it next happens and how many notes are ready for it. */
export default function MeetingList({
  sections,
  today,
  onOpen,
  onAdd,
  onDelete,
}: {
  sections: MeetingSection[]
  today: string
  onOpen: (id: string, date: string) => void
  onAdd: () => void
  onDelete: (meeting: Meeting) => void
}) {
  if (!sections.length) {
    return (
      <div className="empty-state">
        <h2>Notes for your meetings</h2>
        <p>Add a meeting that happens once or every week. It shows on the calendar, and you can keep notes for the next one.</p>
        <button className="button button-primary empty-state-action" type="button" onClick={onAdd}>
          <Plus size={16} aria-hidden="true" /> Add a meeting
        </button>
      </div>
    )
  }
  return (
    <div className="task-sections">
      {sections.map((section) => (
        <section key={section.id} className="task-section" aria-labelledby={`meetings-${section.id}`}>
          <h2 id={`meetings-${section.id}`} className="section-label">
            {section.label}
          </h2>
          <ul className="row-list">
            {section.items.map(({ meeting, date, noteCount }) => {
              const days = daysBetween(today, date)
              return (
                <li key={meeting.id} className="meeting-list-item">
                  <button className="list-row" type="button" onClick={() => onOpen(meeting.id, date)}>
                    <span className="list-row-body">
                      <span className="list-row-title">{meeting.title}</span>
                      <span className="list-row-meta">
                        {scheduleLabel(meeting, today)}
                        {noteCount > 0 && ` · ${plural(noteCount, 'note')}`}
                      </span>
                    </span>
                    <span className={`list-row-when${days === 0 || days === 1 ? ' is-soon' : ''}`}>{countdownLabel(days)}</span>
                    <ChevronRight className="list-row-chevron" size={17} aria-hidden="true" />
                  </button>
                  <button className="icon-button button-danger-text" type="button" aria-label={`Delete ${meeting.title}`} onClick={() => onDelete(meeting)}><Trash2 size={16} /></button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

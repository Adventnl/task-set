import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import type { MeetingNote } from '../../../shared/types/meeting'
import { countdownLabel, daysBetween, longDayLabel } from '../../../shared/utils/dates'
import type { MeetingDetail as Detail } from '../../../shared/utils/meetingView'
import { plural } from '../../../shared/utils/taskView'

/**
 * One meeting day and its notes. It opens on the next meeting; the arrows step a week at a time, and
 * other days with notes are listed below. The composer adds to the day on screen.
 */
export default function MeetingDetail({
  detail,
  today,
  onPickDate,
  onDeleteNote,
}: {
  detail: Detail
  today: string
  onPickDate: (date: string) => void
  onDeleteNote: (note: MeetingNote) => void
}) {
  const { date, next, previous, following, notes, otherDays } = detail
  const isNext = date === next
  const repeats = !!(previous || following)

  return (
    <div className="meeting">
      <div className="meeting-day">
        {repeats && (
          <button className="icon-button" type="button" onClick={() => previous && onPickDate(previous)} disabled={!previous} aria-label="Previous meeting">
            <ChevronLeft size={20} />
          </button>
        )}
        <div className="meeting-day-label" aria-live="polite">
          <p className="meeting-day-date">{longDayLabel(date, today)}</p>
          <p className="meeting-day-when">
            {isNext && <span className="meeting-day-badge">Next meeting</span>}
            {countdownLabel(daysBetween(today, date))}
          </p>
        </div>
        {repeats && (
          <button className="icon-button" type="button" onClick={() => following && onPickDate(following)} disabled={!following} aria-label="Following meeting">
            <ChevronRight size={20} />
          </button>
        )}
      </div>
      {!isNext && next && (
        <button className="link-button meeting-to-next" type="button" onClick={() => onPickDate(next)}>
          Go to the next meeting
        </button>
      )}

      {notes.length ? (
        <ul className="row-list meeting-notes" aria-label="Notes for this meeting">
          {notes.map((note) => (
            <li key={note.id} className="meeting-note">
              <p className="meeting-note-text" id={`meeting-note-${note.id}`}>
                {note.text}
              </p>
              <button
                className="icon-button icon-button-small meeting-note-delete"
                type="button"
                onClick={() => onDeleteNote(note)}
                aria-label="Delete note"
                aria-describedby={`meeting-note-${note.id}`}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="agenda-empty">
          {isNext ? 'Nothing for the next meeting yet. Write below what you want to bring up, or hold the microphone and talk.' : 'No notes for this meeting yet. Write them below.'}
        </p>
      )}

      {otherDays.length > 0 && (
        <section className="task-section" aria-labelledby="meeting-other-days">
          <h2 id="meeting-other-days" className="section-label">
            Other days with notes
          </h2>
          <ul className="row-list">
            {otherDays.map((day) => (
              <li key={day.date}>
                <button className="list-row" type="button" onClick={() => onPickDate(day.date)}>
                  <span className="list-row-body">
                    <span className="list-row-title">{longDayLabel(day.date, today)}</span>
                    <span className="list-row-meta">{plural(day.count, 'note')}</span>
                  </span>
                  <span className="list-row-when">{countdownLabel(daysBetween(today, day.date))}</span>
                  <ChevronRight className="list-row-chevron" size={17} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

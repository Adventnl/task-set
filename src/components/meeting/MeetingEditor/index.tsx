import { X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { Meeting, MeetingInput } from '../../../shared/types/meeting'
import { isDateKey } from '../../../shared/utils/dates'
import { scheduleLabel } from '../../../shared/utils/meetingView'
import { MAX_TITLE_LENGTH } from '../../../shared/utils/records'
import Modal from '../../app/Modal'

const REPEATS: { id: 'weekly' | 'once'; label: string }[] = [
  { id: 'weekly', label: 'Every week' },
  { id: 'once', label: 'Once' },
]

/**
 * Adds or edits a meeting: a name, a day, an optional time, and whether it repeats weekly. There is
 * deliberately no end time, reminder, or time zone to fill in.
 */
export default function MeetingEditor({
  meeting,
  defaultDate,
  today,
  onClose,
  onSave,
  onDelete,
}: {
  /** Null when adding a meeting. */
  meeting: Meeting | null
  defaultDate: string
  today: string
  onClose: () => void
  onSave: (input: MeetingInput) => Promise<void>
  onDelete: () => void
}) {
  const [title, setTitle] = useState(meeting?.title ?? '')
  const [date, setDate] = useState(meeting?.date ?? defaultDate)
  const [time, setTime] = useState(meeting?.time ?? '')
  const [repeat, setRepeat] = useState<Meeting['repeat']>(meeting ? meeting.repeat : 'weekly')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const valid = !!title.trim() && isDateKey(date)
  const input: MeetingInput = { title: title.trim(), date, time: time || null, repeat }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError('')
    try {
      await onSave(input)
      onClose()
    } catch {
      setError('Could not save on this device. Try again.')
      setBusy(false)
    }
  }

  return (
    <Modal labelledBy="meeting-editor-title" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-head">
          <h2 id="meeting-editor-title" className="modal-title">
            {meeting ? 'Edit meeting' : 'New meeting'}
          </h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <label className="field-label" htmlFor="meeting-title">
          Name
        </label>
        <input
          id="meeting-title"
          className="text-field"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={MAX_TITLE_LENGTH}
          placeholder="Team sync"
          autoFocus
          required
        />
        <div className="date-grid">
          <div>
            <label className="field-label" htmlFor="meeting-date">
              {repeat ? 'First day' : 'Day'}
            </label>
            <input id="meeting-date" className="text-field" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </div>
          <div>
            <label className="field-label" htmlFor="meeting-time">
              Time <span className="field-optional">(optional)</span>
            </label>
            <div className="date-field-row">
              <input id="meeting-time" className="text-field" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
              {time && (
                <button className="button button-quiet button-small" type="button" onClick={() => setTime('')} aria-label="Clear time">
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
        <fieldset className="editor-section">
          <legend className="field-label">Repeats</legend>
          <div className="segmented">
            {REPEATS.map(({ id, label }) => (
              <label key={id} className="segmented-option">
                <input
                  className="sr-only"
                  type="radio"
                  name="meeting-repeat"
                  value={id}
                  checked={(repeat ?? 'once') === id}
                  onChange={() => setRepeat(id === 'weekly' ? 'weekly' : null)}
                />
                {label}
              </label>
            ))}
          </div>
          {isDateKey(date) && <p className="modal-note">{scheduleLabel(input, today)}</p>}
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          {meeting && (
            <button className="button button-quiet button-danger-text" type="button" onClick={onDelete} disabled={busy}>
              Delete
            </button>
          )}
          <button className="button button-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button button-primary" type="submit" disabled={busy || !valid}>
            {busy ? 'Saving…' : meeting ? 'Save' : 'Add meeting'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

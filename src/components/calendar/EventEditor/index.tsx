import { X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { CalendarEvent, EventInput } from '../../../shared/types/calendar'
import { isDateKey } from '../../../shared/utils/dates'
import { MAX_CAPTURE_LENGTH } from '../../../shared/utils/records'
import Modal from '../../app/Modal'

/** Corrects an event's words or moves it to another day. */
export default function EventEditor({
  event,
  onClose,
  onSave,
  onDelete,
}: {
  event: CalendarEvent
  onClose: () => void
  onSave: (input: EventInput) => Promise<void>
  onDelete: () => void
}) {
  const [text, setText] = useState(event.text)
  const [date, setDate] = useState(event.date)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const valid = !!text.trim() && isDateKey(date)

  async function submit(submitted: FormEvent) {
    submitted.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError('')
    try {
      await onSave({ date, text: text.trim() })
      onClose()
    } catch {
      setError('Could not save on this device. Try again.')
      setBusy(false)
    }
  }

  return (
    <Modal labelledBy="event-editor-title" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-head">
          <h2 id="event-editor-title" className="modal-title">
            Edit event
          </h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <label className="field-label" htmlFor="event-text">
          What
        </label>
        <textarea
          id="event-text"
          className="text-field text-area"
          rows={3}
          value={text}
          onChange={(change) => setText(change.target.value)}
          maxLength={MAX_CAPTURE_LENGTH}
          autoFocus
          required
        />
        <label className="field-label field-label-spaced" htmlFor="event-date">
          Day
        </label>
        <input id="event-date" className="text-field" type="date" value={date} onChange={(change) => setDate(change.target.value)} required />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="button button-quiet button-danger-text" type="button" onClick={onDelete} disabled={busy}>
            Delete
          </button>
          <button className="button button-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button button-primary" type="submit" disabled={busy || !valid}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

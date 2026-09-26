import { X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { MAX_TITLE_LENGTH } from '../../../shared/utils/records'
import type { Capture, Editor, TaskInput } from '../../../shared/types/task'
import { fromLocalInput, toLocalInput } from '../../../shared/utils/taskView'
import Modal from '../../app/Modal'

function DateField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="date-field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="date-field-row">
        <input id={id} className="text-field" type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} />
        {value && (
          <button className="button button-quiet button-small" type="button" onClick={() => onChange('')} aria-label={`Clear ${label.toLowerCase()}`}>
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

export default function TaskEditor({
  editor,
  capture,
  onClose,
  onSave,
  onDelete,
}: {
  editor: Editor
  capture: Capture | undefined
  onClose: () => void
  onSave: (input: TaskInput) => Promise<void>
  onDelete: () => void
}) {
  const task = editor.task
  const reviewing = task?.suggestionStatus === 'suggested'
  const [title, setTitle] = useState(task?.title ?? (capture?.text ?? '').slice(0, 120))
  const [dueAt, setDueAt] = useState(toLocalInput(task?.dueAt ?? null))
  const [reminderAt, setReminderAt] = useState(toLocalInput(task?.reminderAt ?? null))
  const [pinned, setPinned] = useState(task?.pinned ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      await onSave({ title: title.trim(), dueAt: fromLocalInput(dueAt), reminderAt: fromLocalInput(reminderAt), pinned })
      onClose()
    } catch {
      setError('Could not save on this device. Try again.')
      setBusy(false)
    }
  }

  return (
    <Modal labelledBy="editor-title" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-head">
          <h2 id="editor-title" className="modal-title">
            {reviewing ? 'Review suggestion' : task ? 'Edit task' : 'New task'}
          </h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {capture && <blockquote className="editor-source">{capture.text}</blockquote>}
        <label className="field-label" htmlFor="task-title">
          Task
        </label>
        <input
          id="task-title"
          className="text-field"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={MAX_TITLE_LENGTH}
          autoFocus
          required
        />
        <div className="date-grid">
          <DateField id="task-due" label="Due" value={dueAt} onChange={setDueAt} />
          <DateField id="task-reminder" label="Reminder" value={reminderAt} onChange={setReminderAt} />
        </div>
        <label className="check-field">
          <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />
          Keep on Today
        </label>
        <p className="modal-note">Reminder times organize Today and Upcoming. Notifications are not sent yet.</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          {task && !reviewing && (
            <button className="button button-quiet button-danger-text" type="button" onClick={onDelete} disabled={busy}>
              Delete
            </button>
          )}
          <button className="button button-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button button-primary" type="submit" disabled={busy || !title.trim()}>
            {busy ? 'Saving…' : reviewing || !task ? 'Create task' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

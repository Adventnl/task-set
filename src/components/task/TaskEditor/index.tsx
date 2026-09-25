import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { Capture, Editor, TaskInput } from '../../../shared/types/task'
import { fromLocalInput, toLocalInput } from '../../../shared/utils/taskView'

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
  onDelete: () => Promise<void>
}) {
  const [title, setTitle] = useState(
    editor.task?.title ?? (capture?.text || '').slice(0, 120),
  )
  const [dueAt, setDueAt] = useState(toLocalInput(editor.task?.dueAt ?? null))
  const [reminderAt, setReminderAt] = useState(
    toLocalInput(editor.task?.reminderAt ?? null),
  )
  const [pinned, setPinned] = useState(editor.task?.pinned ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    titleRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
      if (event.key !== 'Tab' || !dialogRef.current) return
      const controls = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled)',
        ),
      )
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus()
    }
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      await onSave({
        title: title.trim(),
        dueAt: fromLocalInput(dueAt),
        reminderAt: fromLocalInput(reminderAt),
        pinned,
      })
    } catch {
      setError('Could not save the task. Please try again.')
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm('Remove this task? The original capture will stay.'))
      return
    setBusy(true)
    try {
      await onDelete()
    } catch {
      setError('Could not remove the task. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialogRef}
        className="task-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="dialog-head">
          <div>
            <h2 id="dialog-title">
              {editor.task ? 'Edit task' : 'Make a task'}
            </h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="task-title">
            What needs doing?
          </label>
          <input
            ref={titleRef}
            id="task-title"
            className="text-field"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Task name"
            maxLength={200}
            required
          />
          <div className="field-grid">
            <div>
              <label className="field-label" htmlFor="task-due">
                Due date <span>optional</span>
              </label>
              <input
                id="task-due"
                className="text-field"
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="task-reminder">
                Reminder <span>optional</span>
              </label>
              <input
                id="task-reminder"
                className="text-field"
                type="datetime-local"
                value={reminderAt}
                onChange={(event) => setReminderAt(event.target.value)}
              />
            </div>
          </div>
          <p className="field-note">
            Reminder times are saved here; notifications are not available yet.
          </p>
          <label className="pin-row">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(event) => setPinned(event.target.checked)}
            />{' '}
            Keep on Today
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            {editor.task && (
              <button
                className="text-button danger"
                type="button"
                onClick={remove}
                disabled={busy}
              >
                Remove task
              </button>
            )}
            <div className="dialog-action-right">
              <button
                className="secondary-button"
                type="button"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={busy || !title.trim()}
              >
                {busy ? 'Saving…' : 'Save task'}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  )
}

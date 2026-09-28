import { CircleAlert, LoaderCircle, Sparkles } from 'lucide-react'
import type { Capture, Task } from '../../../shared/types/task'
import SuggestionRow from '../../task/SuggestionRow'

/** What the AI is doing with a note: finding tasks, a failure to retry, or suggestions to add or dismiss. */
export default function CaptureTasks({
  capture,
  suggestions,
  onRetry,
  onAccept,
  onEdit,
  onDismiss,
}: {
  capture: Capture
  suggestions: Task[]
  onRetry: (capture: Capture) => void
  onAccept: (task: Task) => void
  onEdit: (task: Task) => void
  onDismiss: (task: Task) => void
}) {
  return (
    <>
      {capture.ai === 'queued' && (
        <p className="capture-status" role="status">
          <LoaderCircle className="spin" size={13} aria-hidden="true" /> Finding tasks…
        </p>
      )}
      {capture.ai === 'failed' && (
        <p className="capture-status capture-status-error" role="status">
          <CircleAlert size={13} aria-hidden="true" /> Couldn’t find tasks.
          <button className="link-button" type="button" onClick={() => onRetry(capture)}>
            Try again
          </button>
        </p>
      )}
      {suggestions.length > 0 && (
        <section className="suggestions" aria-label="Suggested tasks">
          <p className="suggestions-label" aria-hidden="true">
            <Sparkles size={12} /> Add as tasks?
          </p>
          {suggestions.map((task) => (
            <SuggestionRow key={task.id} task={task} onAccept={onAccept} onEdit={onEdit} onDismiss={onDismiss} />
          ))}
        </section>
      )}
    </>
  )
}

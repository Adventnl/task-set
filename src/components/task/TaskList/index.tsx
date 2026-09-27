import type { Capture, Task } from '../../../shared/types/task'
import type { TaskSection } from '../../../shared/utils/taskView'
import TaskRow from '../TaskRow'
import SuggestionRow from '../SuggestionRow'

/** The Tasks view: open tasks under Pinned, No date, and Scheduled. */
export default function TaskList({
  sections, suggestions, generating, onAccept, onDismiss, onRetry,
  onToggle,
  onEdit,
  onTogglePin,
}: {
  sections: TaskSection[]
  suggestions: Task[]
  generating: Capture[]
  onAccept: (task: Task) => void
  onDismiss: (task: Task) => void
  onRetry: (capture: Capture) => void
  onToggle: (task: Task) => void
  onEdit: (task: Task) => void
  onTogglePin: (task: Task) => void
}) {
  if (!sections.length && !suggestions.length && !generating.length) {
    return (
      <div className="empty-state">
        <h2>Nothing to do</h2>
        <p>Write “generate task” in a note, or choose Make task from its ⋯ menu. Completing a task moves it to the Archive.</p>
      </div>
    )
  }
  return (
    <div className="task-sections">
      {generating.map((capture) => (
        <p className="modal-note" key={capture.id} role="status">
          {capture.ai === 'failed' ? 'Could not generate tasks.' : 'Generating tasks…'}
          {capture.ai === 'failed' && <button className="button button-quiet" type="button" onClick={() => onRetry(capture)}>Try again</button>}
        </p>
      ))}
      {suggestions.length > 0 && (
        <section className="suggestions" aria-label="Suggested tasks">
          <h2 className="suggestions-label">Suggestions to review</h2>
          {suggestions.map((task) => <SuggestionRow key={task.id} task={task} onAccept={onAccept} onEdit={onEdit} onDismiss={onDismiss} />)}
        </section>
      )}
      {sections.map((section) => (
        <section key={section.id} className="task-section" aria-labelledby={`tasks-${section.id}`}>
          <h2 id={`tasks-${section.id}`} className="section-label">
            {section.label}
          </h2>
          <div className="task-list">
            {section.tasks.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={onToggle} onEdit={onEdit} onTogglePin={onTogglePin} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

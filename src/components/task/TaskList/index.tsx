import type { Task } from '../../../shared/types/task'
import type { TaskSection } from '../../../shared/utils/taskView'
import TaskRow from '../TaskRow'

/** The Tasks view: pinned, no date, scheduled, and done today, each under its own heading. */
export default function TaskList({
  sections,
  onToggle,
  onEdit,
  onTogglePin,
}: {
  sections: TaskSection[]
  onToggle: (task: Task) => void
  onEdit: (task: Task) => void
  onTogglePin: (task: Task) => void
}) {
  if (!sections.length) {
    return (
      <div className="empty-state">
        <h2>No tasks yet</h2>
        <p>Create a task from a message in the Feed. Tasks without a date come first, then dated ones, soonest first. Pin a task to keep it on top.</p>
      </div>
    )
  }
  return (
    <div className="task-sections">
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

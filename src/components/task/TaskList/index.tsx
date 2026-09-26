import type { Task } from '../../../shared/types/task'
import type { TaskSection } from '../../../shared/utils/taskView'
import TaskRow from '../TaskRow'

/** The Tasks view: open tasks under Pinned, No date, and Scheduled. */
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
        <h2>Nothing to do</h2>
        <p>Create a task from a suggestion under a note, or from a note’s ⋯ menu. Completing a task moves it to the Archive.</p>
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

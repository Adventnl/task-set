import type { Task, TaskView } from '../../../shared/types/task'
import type { TaskSection } from '../../../shared/utils/taskView'
import TaskRow from '../TaskRow'

const empty: Record<TaskView, { title: string; text: string }> = {
  today: { title: 'Nothing due today', text: 'Pinned tasks and anything scheduled for today appear here.' },
  inbox: { title: 'No undated tasks', text: 'Tasks without a date or reminder land here until you schedule them.' },
  upcoming: { title: 'Nothing scheduled', text: 'Tasks with a future due date or reminder appear here, grouped by day.' },
}

export default function TaskList({
  view,
  sections,
  onToggle,
  onEdit,
}: {
  view: TaskView
  sections: TaskSection[]
  onToggle: (task: Task) => void
  onEdit: (task: Task) => void
}) {
  if (!sections.length) {
    return (
      <div className="empty-state">
        <h2>{empty[view].title}</h2>
        <p>{empty[view].text}</p>
      </div>
    )
  }
  return (
    <div className="task-sections">
      {sections.map((section) => (
        <section key={section.id} className="task-section">
          {section.label && <h2 className="section-label">{section.label}</h2>}
          <div className="task-list">
            {section.tasks.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={onToggle} onEdit={onEdit} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

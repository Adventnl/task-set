import { Check } from 'lucide-react'
import type { Task } from '../../../shared/types/task'
import TaskMeta from '../TaskMeta'

export default function TaskRow({
  task,
  onToggle,
  onEdit,
  linked = false,
}: {
  task: Task
  onToggle: (task: Task) => void
  onEdit: (task: Task) => void
  /** Shown under its source message rather than in a task list. */
  linked?: boolean
}) {
  const done = !!task.completedAt
  return (
    <div className={`task-row${linked ? ' task-row-linked' : ''}${done ? ' is-done' : ''}`}>
      <button
        className="task-check"
        type="button"
        role="checkbox"
        aria-checked={done}
        onClick={() => onToggle(task)}
        aria-label={`${done ? 'Reopen' : 'Complete'} “${task.title}”`}
      >
        <span className="task-check-box" aria-hidden="true">
          {done && <Check size={12} strokeWidth={3} />}
        </span>
      </button>
      <button className="task-body" type="button" onClick={() => onEdit(task)} aria-label={`Edit “${task.title}”`}>
        <span className="task-title">{task.title}</span>
        <TaskMeta task={task} />
      </button>
    </div>
  )
}

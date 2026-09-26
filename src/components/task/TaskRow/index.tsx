import { Check, Pin } from 'lucide-react'
import type { Task } from '../../../shared/types/task'
import TaskMeta from '../TaskMeta'

export default function TaskRow({
  task,
  onToggle,
  onEdit,
  onTogglePin,
  linked = false,
}: {
  task: Task
  onToggle: (task: Task) => void
  onEdit: (task: Task) => void
  /** Shows a pin toggle; task lists pass it, rows under a message do not. */
  onTogglePin?: (task: Task) => void
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
      {onTogglePin && (
        <button
          className="icon-button task-pin"
          type="button"
          aria-pressed={task.pinned}
          onClick={() => onTogglePin(task)}
          aria-label={`Pin “${task.title}”`}
          title={task.pinned ? 'Unpin' : 'Pin to the top'}
        >
          <Pin size={16} fill={task.pinned ? 'currentColor' : 'none'} />
        </button>
      )}
    </div>
  )
}

import { Check } from 'lucide-react'
import type { Task } from '../../../shared/types/task'
import { dateTimeLabel } from '../../../shared/utils/taskView'

export default function TaskRow({
  task,
  onToggle,
  onEdit,
  compact = false,
}: {
  task: Task
  onToggle: (task: Task) => void
  onEdit: (task: Task) => void
  compact?: boolean
}) {
  return (
    <div
      className={`task-row ${compact ? 'task-row-compact' : ''} ${task.completedAt ? 'is-complete' : ''}`}
    >
      <button
        className="task-check"
        type="button"
        onClick={() => onToggle(task)}
        aria-label={`${task.completedAt ? 'Reopen' : 'Complete'} ${task.title}`}
      >
        {task.completedAt ? <Check size={13} strokeWidth={2.5} /> : null}
      </button>
      <button className="task-body" type="button" onClick={() => onEdit(task)}>
        <span className="task-title">{task.title}</span>
        {(task.dueAt || task.reminderAt || task.pinned) && (
          <span className="task-meta">
            {task.dueAt && <span>Due {dateTimeLabel(task.dueAt)}</span>}
            {task.reminderAt && (
              <span>Remind {dateTimeLabel(task.reminderAt)}</span>
            )}
            {task.pinned && <span>On Today</span>}
          </span>
        )}
      </button>
    </div>
  )
}

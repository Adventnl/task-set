import { Bell, CalendarClock } from 'lucide-react'
import type { Task } from '../../../shared/types/task'
import { isOverdue, whenLabel } from '../../../shared/utils/taskView'

/** Due date and reminder, each with an icon and words so neither relies on color. */
export default function TaskMeta({ task }: { task: Task }) {
  if (!task.dueAt && !task.reminderAt) return null
  const overdue = isOverdue(task)
  return (
    <span className="task-meta">
      {task.dueAt && (
        <span className={overdue ? 'task-meta-overdue' : undefined}>
          <CalendarClock size={13} aria-hidden="true" />
          {overdue ? 'Overdue · ' : 'Due '}
          {whenLabel(task.dueAt)}
        </span>
      )}
      {task.reminderAt && (
        <span>
          <Bell size={13} aria-hidden="true" />
          {whenLabel(task.reminderAt)}
        </span>
      )}
    </span>
  )
}

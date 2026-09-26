import { X } from 'lucide-react'
import type { Task } from '../../../shared/types/task'
import TaskMeta from '../TaskMeta'

/** An AI draft. It becomes a real task only when the user creates it. */
export default function SuggestionRow({
  task,
  onAccept,
  onEdit,
  onDismiss,
}: {
  task: Task
  onAccept: (task: Task) => void
  onEdit: (task: Task) => void
  onDismiss: (task: Task) => void
}) {
  return (
    <div className="suggestion">
      <div className="suggestion-main">
        <p className="suggestion-title">{task.title}</p>
        <TaskMeta task={task} />
      </div>
      <div className="suggestion-actions">
        <button className="button button-soft button-small" type="button" onClick={() => onAccept(task)} aria-label={`Create task “${task.title}”`}>
          Create task
        </button>
        <button className="button button-quiet button-small" type="button" onClick={() => onEdit(task)} aria-label={`Edit suggestion “${task.title}”`}>
          Edit
        </button>
        <button className="icon-button icon-button-small" type="button" onClick={() => onDismiss(task)} aria-label={`Dismiss suggestion “${task.title}”`}>
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

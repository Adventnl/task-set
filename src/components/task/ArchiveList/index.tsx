import { Check, RotateCcw, Trash2 } from 'lucide-react'
import { ARCHIVE_DAYS } from '../../../shared/config/archive'
import type { Task } from '../../../shared/types/task'
import { whenLabel, type ArchivedTask } from '../../../shared/utils/taskView'

/** Completed tasks, newest first, each with the days left before it is deleted for good. */
export default function ArchiveList({
  items,
  onRestore,
  onDelete,
}: {
  items: ArchivedTask[]
  onRestore: (task: Task) => void
  onDelete: (task: Task) => void
}) {
  if (!items.length) {
    return (
      <div className="empty-state">
        <h2>Nothing archived</h2>
        <p>Completed tasks come here and are deleted for good after {ARCHIVE_DAYS} days. Restore one to put it back in Tasks.</p>
      </div>
    )
  }
  return (
    <ul className="archive-list">
      {items.map(({ task, daysLeft }) => (
        <li key={task.id} className="archive-row">
          <span className="archive-check" aria-hidden="true">
            <Check size={12} strokeWidth={3} />
          </span>
          <div className="archive-body">
            <p className="archive-title">{task.title}</p>
            <p className="archive-meta">
              <span>
                Done <time dateTime={task.completedAt}>{whenLabel(task.completedAt)}</time>
              </span>
              <span>· {daysLeft === 1 ? '1 day left' : `${daysLeft} days left`}</span>
            </p>
          </div>
          <div className="archive-actions">
            <button className="button button-quiet button-small" type="button" onClick={() => onRestore(task)} aria-label={`Restore “${task.title}”`}>
              <RotateCcw size={15} aria-hidden="true" />
              <span className="archive-action-label">Restore</span>
            </button>
            <button className="icon-button icon-button-small" type="button" onClick={() => onDelete(task)} aria-label={`Delete “${task.title}” now`}>
              <Trash2 size={16} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

import { RotateCcw, Trash2 } from 'lucide-react'
import { NOTE_ARCHIVE_DAYS } from '../../../shared/config/archive'
import type { Capture } from '../../../shared/types/task'
import { whenLabel, type ArchivedCapture } from '../../../shared/utils/taskView'

/** Deleted notes, newest first, each with the days left before it is deleted for good. */
export default function NoteArchiveList({
  items,
  onRestore,
  onDelete,
}: {
  items: ArchivedCapture[]
  onRestore: (capture: Capture) => void
  onDelete: (capture: Capture) => void
}) {
  if (!items.length) {
    return (
      <div className="empty-state">
        <h2>Nothing archived</h2>
        <p>Deleted notes come here and are deleted for good after {NOTE_ARCHIVE_DAYS} days. Restore one to put it back in Notes.</p>
      </div>
    )
  }
  return (
    <ul className="archive-list">
      {items.map(({ capture, daysLeft }) => (
        <li key={capture.id} className="archive-row">
          <div className="archive-body">
            <p className="archive-title note-archive-text">{capture.text}</p>
            <p className="archive-meta">
              <span>
                Deleted <time dateTime={capture.archivedAt}>{whenLabel(capture.archivedAt)}</time>
              </span>
              <span>· {daysLeft === 1 ? '1 day left' : `${daysLeft} days left`}</span>
            </p>
          </div>
          <div className="archive-actions">
            <button className="button button-quiet button-small" type="button" onClick={() => onRestore(capture)} aria-label="Restore this note">
              <RotateCcw size={15} aria-hidden="true" />
              <span className="archive-action-label">Restore</span>
            </button>
            <button className="icon-button icon-button-small" type="button" onClick={() => onDelete(capture)} aria-label="Delete this note now">
              <Trash2 size={16} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

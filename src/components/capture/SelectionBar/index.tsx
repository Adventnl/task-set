import { Trash2, X } from 'lucide-react'

/** Takes the composer's place while Feed messages are being selected for deletion. */
export default function SelectionBar({
  count,
  allSelected,
  onToggleAll,
  onDelete,
  onCancel,
}: {
  count: number
  allSelected: boolean
  onToggleAll: () => void
  onDelete: () => void
  onCancel: () => void
}) {
  return (
    <div className="selection-dock">
      <div className="selection-bar">
        <button className="icon-button" type="button" onClick={onCancel} aria-label="Stop selecting">
          <X size={18} />
        </button>
        <p className="selection-count" role="status">
          {count ? `${count} selected` : 'None selected'}
        </p>
        <button className="button button-quiet button-small" type="button" onClick={onToggleAll}>
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
        <button className="button button-danger button-small selection-delete" type="button" onClick={onDelete} disabled={!count} aria-label="Delete selected messages">
          <Trash2 size={15} aria-hidden="true" />
          <span className="selection-delete-label">Delete</span>
        </button>
      </div>
      <p className="selection-hint">Choose the messages to delete. Tasks made from them are deleted too.</p>
    </div>
  )
}

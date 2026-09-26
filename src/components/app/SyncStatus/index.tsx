import type { SyncStatus as Status } from '../../../shared/types/sync'

const labels: Record<Status, string> = {
  connecting: 'Connecting…',
  synced: 'Synced',
  offline: 'Offline',
  'signed-out': 'Signed out',
  error: 'Sync problem',
}

/** The sync state as a dot and a word; opens the account dialog. */
export default function SyncStatus({ status, compact = false, onOpen }: { status: Status; compact?: boolean; onOpen: () => void }) {
  return (
    <button
      className={`sync-status ${compact ? 'sync-status-compact' : ''}`}
      type="button"
      data-status={status}
      onClick={onOpen}
      aria-label={`${labels[status]}. Sync and account`}
      title={labels[status]}
    >
      <span className="sync-dot" aria-hidden="true" />
      <span className="sync-label">{labels[status]}</span>
    </button>
  )
}

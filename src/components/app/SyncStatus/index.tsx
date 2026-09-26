import { Settings } from 'lucide-react'
import type { SyncStatus as Status } from '../../../shared/types/sync'

const labels: Record<Status, string> = {
  connecting: 'Connecting…',
  synced: 'Synced',
  offline: 'Offline',
  'signed-out': 'Signed out',
  error: 'Sync problem',
}

/**
 * Opens settings and shows the sync state: a dot and a word in the rail, or a settings icon
 * with the dot as a badge in the compact phone header.
 */
export default function SyncStatus({ status, compact = false, onOpen }: { status: Status; compact?: boolean; onOpen: () => void }) {
  return (
    <button
      className={`sync-status ${compact ? 'sync-status-compact' : ''}`}
      type="button"
      data-status={status}
      onClick={onOpen}
      aria-label={`${labels[status]}. Settings`}
      title={`${labels[status]} · Settings`}
    >
      <span className="sync-dot" aria-hidden="true" />
      <span className="sync-label">{labels[status]}</span>
      <Settings className="sync-settings-icon" size={compact ? 19 : 15} aria-hidden="true" />
    </button>
  )
}

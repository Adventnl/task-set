import { Settings } from 'lucide-react'
import type { SyncStatus as Status } from '../../../shared/types/sync'

export const SYNC_LABELS: Record<Status, string> = {
  connecting: 'Connecting…',
  synced: 'Synced',
  offline: 'Offline',
  'signed-out': 'Signed out',
  error: 'Sync problem',
}

/** Opens settings and shows the sync state as a dot and a word, at the foot of the sidebar. */
export default function SyncStatus({ status, onOpen }: { status: Status; onOpen: () => void }) {
  return (
    <button
      className="sync-status"
      type="button"
      data-status={status}
      onClick={onOpen}
      aria-label={`${SYNC_LABELS[status]}. Settings`}
      title={`${SYNC_LABELS[status]} · Settings`}
    >
      <span className="sync-dot" aria-hidden="true" />
      <span className="sync-label">{SYNC_LABELS[status]}</span>
      <Settings className="sync-settings-icon" size={15} aria-hidden="true" />
    </button>
  )
}

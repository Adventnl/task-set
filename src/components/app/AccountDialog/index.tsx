import { useEffect, useState } from 'react'
import type { SyncStatus } from '../../../shared/types/sync'
import Modal from '../Modal'

const descriptions: Record<SyncStatus, string> = {
  connecting: 'Checking the connection to Task Set.',
  synced: 'Everything is saved. Changes reach your other signed-in devices within seconds.',
  offline: 'Saved on this device. Changes sync when the connection is back.',
  'signed-out': 'Sign in to sync this device.',
  error: 'Saved on this device, but sync is failing. It keeps retrying.',
}

export default function AccountDialog({
  status,
  message,
  countUnsynced,
  onSignOut,
  onClose,
}: {
  status: SyncStatus
  message: string
  countUnsynced: () => Promise<number>
  onSignOut: () => Promise<void>
  onClose: () => void
}) {
  const [unsynced, setUnsynced] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    countUnsynced().then(setUnsynced, () => setUnsynced(0))
  }, [countUnsynced, status])

  async function signOut() {
    setBusy(true)
    setError('')
    try {
      await onSignOut()
      onClose()
    } catch {
      setError('Could not reach Task Set to sign out. Try again when you are online.')
      setBusy(false)
    }
  }

  return (
    <Modal labelledBy="account-title" onClose={onClose}>
      <h2 id="account-title" className="modal-title">
        Sync
      </h2>
      <p className="modal-text sync-detail" data-status={status}>
        <span className="sync-dot" aria-hidden="true" />
        <span>
          {descriptions[status]}
          {message && ` ${message}`}
        </span>
      </p>
      {unsynced > 0 && (
        <p className="modal-note">
          {unsynced} change{unsynced === 1 ? ' is' : 's are'} waiting to sync. Signing out now would remove {unsynced === 1 ? 'it' : 'them'} from this device.
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="button button-quiet button-danger-text" type="button" onClick={() => void signOut()} disabled={busy || status === 'signed-out'}>
          Sign out of this device
        </button>
        <button className="button button-secondary" type="button" onClick={onClose} autoFocus>
          Done
        </button>
      </div>
    </Modal>
  )
}

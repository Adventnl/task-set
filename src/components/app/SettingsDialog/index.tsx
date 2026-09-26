import { Download, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { InstallStatus } from '../../../shared/hooks/useInstallPrompt'
import type { Appearance } from '../../../shared/types/appearance'
import type { SyncStatus } from '../../../shared/types/sync'
import Modal from '../Modal'

const descriptions: Record<SyncStatus, string> = {
  connecting: 'Checking the connection to Task Set.',
  synced: 'Everything is saved. Changes reach your other signed-in devices within seconds.',
  offline: 'Saved on this device. Changes sync when the connection is back.',
  'signed-out': 'Sign in to sync this device.',
  error: 'Saved on this device, but sync is failing. It keeps retrying.',
}

const installNotes: Record<Exclude<InstallStatus, 'available'>, string> = {
  installed: 'Task Set is installed on this device. It opens in its own window and works offline.',
  manual:
    'To install, use Install in the address bar or menu in Chrome and Edge. In Safari, choose Share, then Add to Home Screen (or File, then Add to Dock on a Mac).',
}

const appearances: { id: Appearance; label: string; icon: LucideIcon }[] = [
  { id: 'system', label: 'System', icon: Monitor },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
]

export default function SettingsDialog({
  appearance,
  appearanceSaveFailed,
  status,
  message,
  countUnsynced,
  installStatus,
  onInstall,
  onAppearanceChange,
  onSignOut,
  onClose,
}: {
  appearance: Appearance
  appearanceSaveFailed: boolean
  status: SyncStatus
  message: string
  countUnsynced: () => Promise<number>
  installStatus: InstallStatus
  onInstall: () => void
  onAppearanceChange: (appearance: Appearance) => void
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
    <Modal labelledBy="settings-title" onClose={onClose}>
      <h2 id="settings-title" className="modal-title">
        Settings
      </h2>
      <fieldset className="settings-section">
        <legend className="field-label">Appearance</legend>
        <div className="segmented">
          {appearances.map(({ id, label, icon: Icon }) => (
            <label key={id} className="segmented-option">
              <input className="sr-only" type="radio" name="appearance" value={id} checked={appearance === id} onChange={() => onAppearanceChange(id)} />
              <Icon size={15} aria-hidden="true" />
              {label}
            </label>
          ))}
        </div>
        <p className="modal-note">
          {appearanceSaveFailed ? 'This browser is blocking storage, so the choice lasts only until you reload.' : 'Applies to this device only.'}
        </p>
      </fieldset>
      <section className="settings-section" aria-labelledby="settings-app">
        <h3 id="settings-app" className="field-label">
          App
        </h3>
        {installStatus === 'available' ? (
          <>
            <button className="button button-secondary" type="button" onClick={onInstall}>
              <Download size={16} aria-hidden="true" /> Install Task Set
            </button>
            <p className="modal-note">Opens in its own window, like any other app, and works offline.</p>
          </>
        ) : (
          <p className="modal-text">{installNotes[installStatus]}</p>
        )}
      </section>
      <section className="settings-section" aria-labelledby="settings-sync">
        <h3 id="settings-sync" className="field-label">
          Sync
        </h3>
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
      </section>
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

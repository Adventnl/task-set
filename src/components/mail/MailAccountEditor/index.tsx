import { X } from 'lucide-react'
import { useState } from 'react'
import { MAIL_PROVIDERS, MAIL_PROVIDER_IDS } from '../../../shared/config/mail'
import type { MailAccountEditor as Editor, MailAccountInput, MailProvider } from '../../../shared/types/mail'
import Modal from '../../app/Modal'
import MailSetupGuide from '../MailSetupGuide'

export default function MailAccountEditor({ editor, busy, error, onClose, onSave }: {
  editor: Editor
  busy: boolean
  error: string
  onClose: () => void
  onSave: (input: MailAccountInput) => Promise<void>
}) {
  const [provider, setProvider] = useState(editor.provider)
  const [address, setAddress] = useState(editor.address)
  const [label, setLabel] = useState(editor.label)
  return (
    <Modal labelledBy="mail-editor-title" onClose={onClose}>
      <form onSubmit={(event) => { event.preventDefault(); if (!busy) void onSave({ provider, address, label }) }}>
        <div className="modal-head">
          <h2 className="modal-title" id="mail-editor-title">{editor.existing ? 'Edit mail account' : 'Add mail account'}</h2>
          <button className="icon-button" type="button" onClick={onClose} disabled={busy} aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </div>
        <p className="modal-text" id="mail-setup-note">Save this account for setup. Mail access is not connected yet. No password is needed here.</p>
        <label className="field-label field-label-spaced" htmlFor="mail-provider">Provider</label>
        <select className="text-field" id="mail-provider" value={provider} disabled={busy} onChange={(event) => setProvider(event.target.value as MailProvider)}>
          {MAIL_PROVIDER_IDS.map((id) => <option key={id} value={id}>{MAIL_PROVIDERS[id].name}</option>)}
        </select>
        <label className="field-label field-label-spaced" htmlFor="mail-address">Email address</label>
        <input className="text-field" id="mail-address" type="email" autoFocus autoComplete="email" required maxLength={254} value={address} disabled={busy} aria-describedby="mail-setup-note" onChange={(event) => setAddress(event.target.value)} />
        <label className="field-label field-label-spaced" htmlFor="mail-label">Label <span className="text-muted">(optional)</span></label>
        <input className="text-field" id="mail-label" maxLength={80} placeholder="Personal or work" value={label} disabled={busy} onChange={(event) => setLabel(event.target.value)} />
        <details className="mail-provider-details"><summary>How {MAIL_PROVIDERS[provider].name} will connect</summary><MailSetupGuide provider={provider} /></details>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="button button-secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="button button-primary" type="submit" disabled={busy || !address.trim()}>{busy ? 'Saving…' : 'Save account setup'}</button>
        </div>
      </form>
    </Modal>
  )
}

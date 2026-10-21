import { X } from 'lucide-react'
import { useState } from 'react'
import { MAX_TITLE_LENGTH } from '../../../shared/utils/records'
import Modal from '../../app/Modal'

export default function ListEditor({ name, busy, error, onClose, onSave }: {
  name: string | null
  busy: boolean
  error: string
  onClose: () => void
  onSave: (name: string) => Promise<void>
}) {
  const [value, setValue] = useState(name ?? '')
  return (
    <Modal labelledBy="list-editor-title" onClose={onClose}>
      <form onSubmit={(event) => { event.preventDefault(); if (value.trim() && !busy) void onSave(value) }}>
        <div className="modal-head">
          <h2 className="modal-title" id="list-editor-title">{name === null ? 'New list' : 'Rename list'}</h2>
          <button className="icon-button" type="button" onClick={onClose} disabled={busy} aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </div>
        <label className="field-label" htmlFor="list-name">List name</label>
        <input className="text-field" id="list-name" autoFocus required maxLength={MAX_TITLE_LENGTH} placeholder="Dinner guests" value={value} disabled={busy} onChange={(event) => setValue(event.target.value)} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="button button-secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="button button-primary" type="submit" disabled={busy || !value.trim()}>{busy ? 'Saving…' : name === null ? 'Create list' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}

import { X } from 'lucide-react'
import Modal from '../../app/Modal'

export default function ListImport({ text, count, busy, error, onChange, onClose, onImport }: {
  text: string
  count: number
  busy: boolean
  error: string
  onChange: (text: string) => void
  onClose: () => void
  onImport: () => Promise<void>
}) {
  return (
    <Modal labelledBy="list-import-title" onClose={onClose}>
      <form onSubmit={(event) => { event.preventDefault(); if (count && !busy) void onImport() }}>
        <div className="modal-head">
          <h2 className="modal-title" id="list-import-title">Import items</h2>
          <button className="icon-button" type="button" onClick={onClose} disabled={busy} aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </div>
        <label className="field-label" htmlFor="list-import">One item per line</label>
        <textarea className="text-field" id="list-import" rows={8} autoFocus value={text} disabled={busy} onChange={(event) => onChange(event.target.value)} placeholder={'Alex\nSam\nJordan'} aria-describedby="list-import-help" />
        <p className="modal-note" id="list-import-help">Paste or type your items. Blank lines are skipped; the order stays the same.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="button button-secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="button button-primary" type="submit" disabled={busy || !count}>{busy ? 'Importing…' : count ? `Add ${count} ${count === 1 ? 'item' : 'items'}` : 'Add items'}</button>
        </div>
      </form>
    </Modal>
  )
}

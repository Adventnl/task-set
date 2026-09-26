import { useState } from 'react'
import Modal from '../Modal'

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => Promise<unknown>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function confirm() {
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      onClose()
    }
  }

  return (
    <Modal labelledBy="confirm-title" onClose={onClose}>
      <h2 id="confirm-title" className="modal-title">
        {title}
      </h2>
      <p className="modal-text">{message}</p>
      <div className="modal-actions">
        <button className="button button-quiet" type="button" onClick={onClose} autoFocus>
          Cancel
        </button>
        <button className="button button-danger" type="button" onClick={() => void confirm()} disabled={busy}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

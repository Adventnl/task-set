import { X } from 'lucide-react'

/**
 * A short-lived message with one action, floating above the composer. The screen's live region
 * announces the change, so this stays silent to assistive technology and only offers the action.
 */
export default function Toast({
  message,
  actionLabel,
  onAction,
  onDismiss,
}: {
  message: string
  actionLabel: string
  onAction: () => void
  onDismiss: () => void
}) {
  return (
    <div className="toast">
      <p className="toast-text">{message}</p>
      <button className="toast-action" type="button" onClick={onAction}>
        {actionLabel}
      </button>
      <button className="icon-button icon-button-small toast-close" type="button" onClick={onDismiss} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  )
}

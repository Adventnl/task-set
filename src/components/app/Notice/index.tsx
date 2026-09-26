import { CircleAlert, X } from 'lucide-react'

export default function Notice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="notice" role="alert">
      <CircleAlert size={17} aria-hidden="true" />
      <p>{message}</p>
      <button className="icon-button" type="button" onClick={onDismiss} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  )
}

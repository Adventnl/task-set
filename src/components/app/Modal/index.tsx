import { useEffect, useRef, type ReactNode } from 'react'

/**
 * A native modal dialog: the browser supplies the focus trap, Escape, and the backdrop.
 * Mount it to open it; it becomes a bottom sheet on narrow screens.
 */
export default function Modal({
  labelledBy,
  onClose,
  children,
}: {
  labelledBy: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => dialog?.close()
  }, [])

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal-body">{children}</div>
    </dialog>
  )
}

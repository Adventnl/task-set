import { Check, Copy, Ellipsis, ListTodo, Mic, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Capture, Task } from '../../../shared/types/task'
import { plural, timeLabel } from '../../../shared/utils/taskView'
import CaptureTasks from '../CaptureTasks'

export interface CaptureActions {
  onCopy: (capture: Capture) => void
  onGenerateTasks: (capture: Capture) => void
  onCreateTask: (capture: Capture) => void
  onDelete: (capture: Capture) => void
  onRetry: (capture: Capture) => void
  onAcceptSuggestion: (task: Task) => void
  onEditTask: (task: Task) => void
  onDismissSuggestion: (task: Task) => void
  onToggleSelected: (capture: Capture) => void
}

/**
 * Original words, how many open tasks came from them, and any suggestions still to review. Hold a
 * note, right-click it, or use its adjacent actions button for Copy, Generate tasks, Make task, and Delete.
 */
export default function CaptureRow({ capture, tasks, selected, actions }: {
  capture: Capture
  /** Open tasks and suggestions made from this note. */
  tasks: Task[]
  selected: boolean | null
  actions: CaptureActions
}) {
  const [open, setOpen] = useState(false)
  const row = useRef<HTMLElement>(null)
  const more = useRef<HTMLButtonElement>(null)
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
  const origin = useRef({ x: 0, y: 0 })
  const selecting = selected !== null
  const suggestions = tasks.filter((task) => task.suggestionStatus === 'suggested')
  const taskCount = tasks.length - suggestions.length
  const menuId = `capture-actions-${capture.id}`
  const timeId = `capture-time-${capture.id}`
  const textId = `capture-text-${capture.id}`

  function cancelHold() {
    if (hold.current) clearTimeout(hold.current)
    hold.current = null
  }

  function choose(action: (capture: Capture) => void) {
    setOpen(false)
    action(capture)
  }

  useEffect(() => cancelHold, [])
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !row.current?.contains(event.target)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); more.current?.focus() }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <article
      ref={row}
      className={`capture${selecting ? ' is-selectable' : ''}`}
      onClick={selecting ? () => actions.onToggleSelected(capture) : undefined}
      onPointerDown={(event) => {
        cancelHold()
        if (selecting || event.button !== 0 || (event.target as HTMLElement).closest('button')) return
        origin.current = { x: event.clientX, y: event.clientY }
        hold.current = setTimeout(() => { setOpen(true); hold.current = null }, 550)
      }}
      onPointerMove={(event) => {
        if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 10) cancelHold()
      }}
      onPointerUp={cancelHold}
      onPointerCancel={cancelHold}
      onPointerLeave={cancelHold}
      onContextMenu={(event) => {
        if (!selecting) { event.preventDefault(); cancelHold(); setOpen(true) }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      {selecting && (
        <button className="task-check select-check" type="button" role="checkbox" aria-checked={selected} aria-labelledby={`${timeId} ${textId}`}>
          <span className="task-check-box" aria-hidden="true">{selected && <Check size={12} strokeWidth={3} />}</span>
        </button>
      )}
      <div className="capture-main">
        <p className="capture-text" id={textId}>{capture.text}</p>
        <div className="capture-head">
          <time id={timeId} dateTime={capture.createdAt}>{timeLabel(capture.createdAt)}</time>
          {capture.kind === 'voice' && <span className="capture-kind"><Mic size={12} aria-hidden="true" /> Voice</span>}
          {taskCount > 0 && <span className="capture-kind"><ListTodo size={12} aria-hidden="true" /> {plural(taskCount, 'task')}</span>}
        </div>
        <div className="capture-extras" inert={selecting}>
          <CaptureTasks
            capture={capture}
            suggestions={suggestions}
            onRetry={actions.onRetry}
            onAccept={actions.onAcceptSuggestion}
            onEdit={actions.onEditTask}
            onDismiss={actions.onDismissSuggestion}
          />
        </div>
      </div>
      {!selecting && (
        <div className="capture-tools">
          <button ref={more} className="icon-button capture-more" type="button" aria-expanded={open} aria-controls={menuId} aria-label="Note actions" onClick={() => setOpen((value) => !value)}>
            <Ellipsis size={17} />
          </button>
          {open && (
            <>
              {/* Shown on phones and touch screens only: there the actions are a bottom sheet over a dimmed page. */}
              <div
                className="sheet-scrim"
                onClick={() => {
                  setOpen(false)
                  more.current?.focus()
                }}
                aria-hidden="true"
              />
              <div className="capture-actions" id={menuId} role="group" aria-label="Note actions">
                <button className="button button-quiet" type="button" autoFocus onClick={() => choose(actions.onCopy)}>
                  <Copy size={15} aria-hidden="true" /> Copy
                </button>
                <button className="button button-quiet" type="button" disabled={capture.ai === 'queued'} onClick={() => choose(actions.onGenerateTasks)}>
                  <Sparkles size={15} aria-hidden="true" /> {capture.ai === 'queued' ? 'Finding tasks…' : 'Generate tasks'}
                </button>
                <button className="button button-quiet" type="button" onClick={() => choose(actions.onCreateTask)}>
                  <Plus size={15} aria-hidden="true" /> Make task
                </button>
                <button className="button button-quiet button-danger-text" type="button" onClick={() => choose(actions.onDelete)}>
                  <Trash2 size={15} aria-hidden="true" /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </article>
  )
}

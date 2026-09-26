import { Check, CircleAlert, Clock, Ellipsis, LoaderCircle, Mic, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Capture, Task } from '../../../shared/types/task'
import { timeLabel } from '../../../shared/utils/taskView'
import SuggestionRow from '../../task/SuggestionRow'
import TaskRow from '../../task/TaskRow'

export interface CaptureActions {
  onToggleTask: (task: Task) => void
  onEditTask: (task: Task) => void
  onAcceptSuggestion: (task: Task) => void
  onDismissSuggestion: (task: Task) => void
  onCreateTask: (capture: Capture) => void
  onDelete: (capture: Capture) => void
  onRetry: (capture: Capture) => void
  onToggleSelected: (capture: Capture) => void
}

function CaptureStatus({ capture, onRetry }: { capture: Capture; onRetry: () => void }) {
  if (capture.ai === null) {
    return (
      <p className="capture-status">
        <Clock size={13} aria-hidden="true" /> Not synced yet
      </p>
    )
  }
  if (capture.ai === 'queued') {
    return (
      <p className="capture-status">
        <LoaderCircle className="spin" size={13} aria-hidden="true" /> Finding tasks…
      </p>
    )
  }
  if (capture.ai === 'failed') {
    return (
      <p className="capture-status capture-status-error">
        <CircleAlert size={13} aria-hidden="true" /> Couldn’t look for tasks.
        <button className="link-button" type="button" onClick={onRetry}>
          Try again
        </button>
      </p>
    )
  }
  return null
}

/**
 * One message in the Feed, with the suggestions and tasks that came from it. While the Feed is
 * selecting (`selected` is not null), the whole row toggles and the controls under the text are
 * inert; the time and text stay readable because they name the row's checkbox.
 */
export default function CaptureRow({
  capture,
  tasks,
  selected,
  actions,
}: {
  capture: Capture
  tasks: Task[]
  selected: boolean | null
  actions: CaptureActions
}) {
  const [open, setOpen] = useState(false)
  const suggestions = tasks.filter((task) => task.suggestionStatus === 'suggested')
  const linked = tasks.filter((task) => !task.suggestionStatus)
  const selecting = selected !== null
  const menuId = `capture-actions-${capture.id}`
  const timeId = `capture-time-${capture.id}`
  const textId = `capture-text-${capture.id}`

  return (
    <article
      className={`capture${selecting ? ' is-selectable' : ''}`}
      // The checkbox is the keyboard control; its clicks bubble here like clicks anywhere on the row.
      onClick={selecting ? () => actions.onToggleSelected(capture) : undefined}
    >
      {selecting && (
        <button className="task-check select-check" type="button" role="checkbox" aria-checked={selected} aria-labelledby={`${timeId} ${textId}`}>
          <span className="task-check-box" aria-hidden="true">
            {selected && <Check size={12} strokeWidth={3} />}
          </span>
        </button>
      )}
      <div className="capture-main">
        <div className="capture-head">
          <time id={timeId} dateTime={capture.createdAt}>
            {timeLabel(capture.createdAt)}
          </time>
          {capture.kind === 'voice' && (
            <span className="capture-kind">
              <Mic size={12} aria-hidden="true" /> Voice
            </span>
          )}
          {!selecting && (
            <button
              className="icon-button capture-more"
              type="button"
              aria-expanded={open}
              aria-controls={menuId}
              aria-label="Message actions"
              onClick={() => setOpen((value) => !value)}
            >
              <Ellipsis size={17} />
            </button>
          )}
        </div>
        <p className="capture-text" id={textId}>
          {capture.text}
        </p>
        <div className="capture-extras" inert={selecting}>
          <CaptureStatus capture={capture} onRetry={() => actions.onRetry(capture)} />
          {suggestions.length > 0 && (
            <section className="suggestions" aria-label="Suggested tasks">
              <p className="suggestions-label" aria-hidden="true">
                <Sparkles size={12} /> Suggested
              </p>
              {suggestions.map((task) => (
                <SuggestionRow key={task.id} task={task} onAccept={actions.onAcceptSuggestion} onEdit={actions.onEditTask} onDismiss={actions.onDismissSuggestion} />
              ))}
            </section>
          )}
          {linked.length > 0 && (
            <div className="capture-tasks">
              {linked.map((task) => (
                <TaskRow key={task.id} task={task} linked onToggle={actions.onToggleTask} onEdit={actions.onEditTask} />
              ))}
            </div>
          )}
          {open && !selecting && (
            <div className="capture-actions" id={menuId}>
              <button className="button button-quiet button-small" type="button" onClick={() => actions.onCreateTask(capture)}>
                <Plus size={15} aria-hidden="true" /> Make a task
              </button>
              <button className="button button-quiet button-small button-danger-text" type="button" onClick={() => actions.onDelete(capture)}>
                <Trash2 size={15} aria-hidden="true" /> Delete message
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

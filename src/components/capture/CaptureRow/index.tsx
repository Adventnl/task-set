import { CircleAlert, Clock, Ellipsis, LoaderCircle, Mic, Plus, Sparkles, Trash2 } from 'lucide-react'
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

/** One message in the Feed, with the suggestions and tasks that came from it. */
export default function CaptureRow({ capture, tasks, actions }: { capture: Capture; tasks: Task[]; actions: CaptureActions }) {
  const [open, setOpen] = useState(false)
  const suggestions = tasks.filter((task) => task.suggestionStatus === 'suggested')
  const linked = tasks.filter((task) => !task.suggestionStatus)
  const menuId = `capture-actions-${capture.id}`

  return (
    <article className="capture">
      <div className="capture-head">
        <time dateTime={capture.createdAt}>{timeLabel(capture.createdAt)}</time>
        {capture.kind === 'voice' && (
          <span className="capture-kind">
            <Mic size={12} aria-hidden="true" /> Voice
          </span>
        )}
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
      </div>
      <p className="capture-text">{capture.text}</p>
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
      {open && (
        <div className="capture-actions" id={menuId}>
          <button className="button button-quiet button-small" type="button" onClick={() => actions.onCreateTask(capture)}>
            <Plus size={15} aria-hidden="true" /> Make a task
          </button>
          <button className="button button-quiet button-small button-danger-text" type="button" onClick={() => actions.onDelete(capture)}>
            <Trash2 size={15} aria-hidden="true" /> Delete message
          </button>
        </div>
      )}
    </article>
  )
}

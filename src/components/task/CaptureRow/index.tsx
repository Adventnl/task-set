import { Plus } from 'lucide-react'
import AudioClip from '../AudioClip'
import TaskRow from '../TaskRow'
import type { useTaskSet } from '../../../shared/hooks/useTaskSet'
import type { Capture, Task } from '../../../shared/types/task'
import { dateTimeLabel, timeLabel } from '../../../shared/utils/taskView'

export default function CaptureRow({
  model,
  capture,
  captureTasks,
}: {
  model: ReturnType<typeof useTaskSet>
  capture: Capture
  captureTasks: Task[]
}) {
  const {
    editingTranscriptId,
    setEditingTranscriptId,
    transcriptDraft,
    setTranscriptDraft,
    processing,
    localSaveFailures,
    retryLocalSave,
    processAi,
    reviewSuggestion,
    saveTranscript,
    setEditor,
    toggleTask,
  } = model
  return (
    <article className="capture-row">
      <div className="capture-content">
        <div className="capture-byline">
          <time dateTime={capture.createdAt}>
            {timeLabel(capture.createdAt)}
          </time>
          {capture.kind === 'voice' && (
            <span className="voice-label">VOICE</span>
          )}
        </div>
        {capture.kind === 'text' ? (
          <p className="capture-text">{capture.text}</p>
        ) : (
          <div className="voice-content">
            {capture.audio && (
              <AudioClip blob={capture.audio} id={capture.id} />
            )}
            {editingTranscriptId === capture.id ? (
              <div className="transcript-form">
                <textarea
                  value={transcriptDraft}
                  onChange={(event) => setTranscriptDraft(event.target.value)}
                  placeholder="Write what you said…"
                  aria-label="Transcript"
                  rows={3}
                />
                <div>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => setEditingTranscriptId(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="small-primary"
                    type="button"
                    onClick={() => void saveTranscript(capture)}
                  >
                    Save text
                  </button>
                </div>
              </div>
            ) : capture.text ? (
              <p className="capture-text transcript-text">
                {capture.text}{' '}
                <button
                  className="inline-link"
                  type="button"
                  disabled={!!processing[capture.id]}
                  onClick={() => {
                    setEditingTranscriptId(capture.id)
                    setTranscriptDraft(capture.text)
                  }}
                >
                  Edit text
                </button>
              </p>
            ) : (
              <button
                className="inline-link add-transcript"
                type="button"
                disabled={!!processing[capture.id]}
                onClick={() => {
                  setEditingTranscriptId(capture.id)
                  setTranscriptDraft('')
                }}
              >
                Add text to this recording
              </button>
            )}
          </div>
        )}
        {localSaveFailures.has(capture.id) ? (
          <div className="ai-status">
            Recording is only in this open tab.{' '}
            <button
              className="inline-link"
              type="button"
              onClick={() => void retryLocalSave(capture)}
            >
              Retry local save
            </button>
          </div>
        ) : (
          <div className="ai-status">
            {processing[capture.id]
              ? `${processing[capture.id] === 'transcribing' ? 'Transcribing' : 'Finding tasks'}…`
              : capture.aiStatus === 'needs-retry'
                ? 'AI needs retry.'
                : capture.aiStatus === 'ready'
                  ? 'Ready'
                  : capture.kind === 'voice' && !capture.text
                    ? 'Saved here. Ready to transcribe.'
                    : null}
            {!processing[capture.id] && capture.aiStatus !== 'ready' && (
              <button
                className="inline-link"
                type="button"
                disabled={editingTranscriptId === capture.id}
                onClick={() => void processAi(capture)}
              >
                {capture.aiStatus === 'needs-retry'
                  ? 'Retry AI'
                  : capture.kind === 'voice' && !capture.text
                    ? 'Transcribe'
                    : 'Suggest tasks'}
              </button>
            )}
          </div>
        )}
        {captureTasks.length > 0 && (
          <div className="linked-tasks">
            {captureTasks.map((task) =>
              task.suggestionStatus === 'suggested' ? (
                <div className="suggestion-row" key={task.id}>
                  <div>
                    <span className="suggestion-tag">Suggested</span>
                    <span className="task-title">{task.title}</span>
                    {(task.reminderAt || task.dueAt) && (
                      <span className="task-meta">
                        {task.reminderAt &&
                          `Remind ${dateTimeLabel(task.reminderAt)}`}
                        {task.dueAt && ` · Due ${dateTimeLabel(task.dueAt)}`}
                      </span>
                    )}
                  </div>
                  <div className="suggestion-actions">
                    <button
                      className="inline-link"
                      type="button"
                      onClick={() => setEditor({ captureId: capture.id, task })}
                    >
                      Edit
                    </button>
                    <button
                      className="inline-link"
                      type="button"
                      onClick={() => void reviewSuggestion(task, 'accept')}
                    >
                      Accept
                    </button>
                    <button
                      className="inline-link"
                      type="button"
                      onClick={() => void reviewSuggestion(task, 'dismiss')}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ) : (
                <TaskRow
                  key={task.id}
                  compact
                  task={task}
                  onToggle={(item) => void toggleTask(item)}
                  onEdit={(item) =>
                    setEditor({
                      captureId: item.captureId,
                      task: item,
                    })
                  }
                />
              ),
            )}
          </div>
        )}
        <button
          className="add-task-button"
          type="button"
          onClick={() => setEditor({ captureId: capture.id })}
        >
          <Plus size={15} /> Add task
        </button>
      </div>
    </article>
  )
}

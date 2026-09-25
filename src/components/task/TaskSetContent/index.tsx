import CaptureRow from '../CaptureRow'
import TaskRow from '../TaskRow'
import type { useTaskSet } from '../../../shared/hooks/useTaskSet'
import { dayKey, dayLabel } from '../../../shared/utils/taskView'

export default function TaskSetContent({
  model,
}: {
  model: ReturnType<typeof useTaskSet>
}) {
  const {
    view,
    loading,
    visibleCaptures,
    tasksByCapture,
    search,
    viewTasks,
    setEditor,
    toggleTask,
  } = model
  return (
    <>
      {loading ? (
        <div className="loading-state">Opening your space…</div>
      ) : view === 'feed' ? (
        visibleCaptures.length ? (
          <div className="capture-list">
            {visibleCaptures.map((capture, index) => {
              const captureTasks = tasksByCapture.get(capture.id) ?? []
              const showDay =
                index === 0 ||
                dayKey(visibleCaptures[index - 1].createdAt) !==
                  dayKey(capture.createdAt)
              return (
                <div key={capture.id}>
                  {showDay && (
                    <div className="day-divider">
                      <span>{dayLabel(capture.createdAt)}</span>
                    </div>
                  )}
                  <CaptureRow
                    model={model}
                    capture={capture}
                    captureTasks={captureTasks}
                  />
                </div>
              )
            })}
          </div>
        ) : (
          <div className="empty-state">
            <h2>{search ? 'No captures found' : 'Start with a thought.'}</h2>
            <p>
              {search
                ? 'Try a different word.'
                : 'Type something below. You can make it a task whenever you are ready.'}
            </p>
          </div>
        )
      ) : viewTasks.length ? (
        <div className="task-list">
          {viewTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={(item) => void toggleTask(item)}
              onEdit={(item) =>
                setEditor({ captureId: item.captureId, task: item })
              }
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>
            {view === 'today'
              ? 'A clear day.'
              : view === 'inbox'
                ? 'All caught up.'
                : 'Nothing coming up.'}
          </h2>
          <p>
            {view === 'today'
              ? 'Pin a task to Today or give it a due date.'
              : view === 'inbox'
                ? 'New tasks without a date will appear here.'
                : 'Tasks with a future due date will appear here.'}
          </p>
        </div>
      )}
    </>
  )
}

import { useRef } from 'react'
import AccountDialog from '../../components/app/AccountDialog'
import ConfirmDialog from '../../components/app/ConfirmDialog'
import NavigationRail from '../../components/app/NavigationRail'
import Notice from '../../components/app/Notice'
import ViewNavigation from '../../components/app/ViewNavigation'
import WorkspaceHeader from '../../components/app/WorkspaceHeader'
import SignInScreen from '../../components/auth/SignInScreen'
import CaptureFeed from '../../components/capture/CaptureFeed'
import type { CaptureActions } from '../../components/capture/CaptureRow'
import Composer from '../../components/capture/Composer'
import TaskEditor from '../../components/task/TaskEditor'
import TaskList from '../../components/task/TaskList'
import { useDictation } from '../../shared/hooks/useDictation'
import { useTaskSet } from '../../shared/hooks/useTaskSet'
import { useWorkspaceView } from '../../shared/hooks/useWorkspaceView'
import type { Capture, Task } from '../../shared/types/task'

export default function TaskSetScreen() {
  const data = useTaskSet()
  const ui = useWorkspaceView(data.captures, data.tasks)
  const scrollRef = useRef<HTMLDivElement>(null)

  const send = (text: string, kind: Capture['kind']) => {
    ui.showFeed()
    return data.sendCapture(text, kind)
  }
  const dictation = useDictation((text) => void send(text, 'voice'))

  if (data.sync.status === 'signed-out') return <SignInScreen onSignIn={data.sync.signIn} />

  const editTask = (task: Task) => ui.setEditor({ captureId: task.captureId, task })
  const confirmDeleteTask = (task: Task) =>
    ui.setConfirmation({
      title: 'Delete this task?',
      message: 'The message it came from stays in your Feed.',
      confirmLabel: 'Delete task',
      onConfirm: () => data.deleteTask(task),
    })
  const actions: CaptureActions = {
    onToggleTask: (task) => void data.toggleTask(task),
    onEditTask: editTask,
    onAcceptSuggestion: (task) => void data.reviewSuggestion(task, 'accept'),
    onDismissSuggestion: (task) => void data.reviewSuggestion(task, 'dismiss'),
    onCreateTask: (capture) => ui.setEditor({ captureId: capture.id }),
    onRetry: (capture) => void data.retrySuggestions(capture),
    onDelete: (capture) =>
      ui.setConfirmation({
        title: 'Delete this message?',
        message: 'Tasks made from it are deleted too, on every device.',
        confirmLabel: 'Delete message',
        onConfirm: () => data.deleteCapture(capture),
      }),
  }
  const editor = ui.editor

  return (
    <div className="app">
      <NavigationRail view={ui.view} counts={ui.counts} status={data.sync.status} onSelect={ui.selectView} onOpenAccount={() => ui.setAccountOpen(true)} />
      <main className="workspace">
        <WorkspaceHeader
          title={ui.title}
          detail={ui.detail}
          status={data.sync.status}
          searchOpen={ui.searchOpen}
          search={ui.search}
          searchRef={ui.searchRef}
          onSearchChange={ui.setSearch}
          onOpenSearch={ui.openSearch}
          onCloseSearch={ui.closeSearch}
          onOpenAccount={() => ui.setAccountOpen(true)}
        />
        <ViewNavigation view={ui.view} counts={ui.counts} variant="tabs" onSelect={ui.selectView} />
        <div className="workspace-scroll" ref={scrollRef}>
          <div className="column">
            {data.notice && <Notice message={data.notice} onDismiss={() => data.setNotice('')} />}
            {data.loading ? null : ui.view === 'feed' ? (
              <CaptureFeed days={ui.feed.days} tasksByCapture={ui.feed.tasksByCapture} search={ui.search.trim()} scrollRef={scrollRef} actions={actions} />
            ) : (
              <TaskList view={ui.view} sections={ui.sections} onToggle={(task) => void data.toggleTask(task)} onEdit={editTask} />
            )}
          </div>
        </div>
        <Composer inputRef={ui.composerRef} dictation={dictation} onSend={(text) => send(text, 'text')} />
      </main>

      {editor && (
        <TaskEditor
          key={editor.task?.id ?? editor.captureId}
          editor={editor}
          capture={data.captures.find((capture) => capture.id === editor.captureId)}
          onClose={() => ui.setEditor(null)}
          onSave={(input) => data.saveTask(editor, input)}
          onDelete={() => {
            ui.setEditor(null)
            if (editor.task) confirmDeleteTask(editor.task)
          }}
        />
      )}
      {ui.confirmation && <ConfirmDialog {...ui.confirmation} onClose={() => ui.setConfirmation(null)} />}
      {ui.accountOpen && (
        <AccountDialog
          status={data.sync.status}
          message={data.sync.message}
          countUnsynced={data.sync.unsyncedChangeCount}
          onSignOut={data.sync.signOut}
          onClose={() => ui.setAccountOpen(false)}
        />
      )}
      <div className="sr-only" role="status" aria-live="polite">
        {data.announcement}
      </div>
    </div>
  )
}

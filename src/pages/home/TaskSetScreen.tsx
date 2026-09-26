import { useRef } from 'react'
import ConfirmDialog from '../../components/app/ConfirmDialog'
import NavigationRail from '../../components/app/NavigationRail'
import Notice from '../../components/app/Notice'
import SettingsDialog from '../../components/app/SettingsDialog'
import Toast from '../../components/app/Toast'
import ViewNavigation from '../../components/app/ViewNavigation'
import WorkspaceHeader from '../../components/app/WorkspaceHeader'
import SignInScreen from '../../components/auth/SignInScreen'
import CaptureFeed from '../../components/capture/CaptureFeed'
import type { CaptureActions } from '../../components/capture/CaptureRow'
import Composer from '../../components/capture/Composer'
import SelectionBar from '../../components/capture/SelectionBar'
import ArchiveList from '../../components/task/ArchiveList'
import TaskEditor from '../../components/task/TaskEditor'
import TaskList from '../../components/task/TaskList'
import { useAppearance } from '../../shared/hooks/useAppearance'
import { useDictation } from '../../shared/hooks/useDictation'
import { useInstallPrompt } from '../../shared/hooks/useInstallPrompt'
import { useTaskSet } from '../../shared/hooks/useTaskSet'
import { useWorkspaceView } from '../../shared/hooks/useWorkspaceView'
import type { Capture, Task } from '../../shared/types/task'

export default function TaskSetScreen() {
  const appearance = useAppearance()
  const installer = useInstallPrompt()
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
  const openSettings = () => ui.setSettingsOpen(true)
  const install = () => void installer.install()
  const confirmDeleteTask = (task: Task) =>
    ui.setConfirmation({
      title: 'Delete this task?',
      message: 'It is deleted for good. The note it came from stays in Notes.',
      confirmLabel: 'Delete task',
      onConfirm: () => data.deleteTask(task),
    })
  const confirmDeleteCaptures = (captures: Capture[]) => {
    const one = captures.length === 1
    ui.setConfirmation({
      title: one ? 'Delete this note?' : `Delete ${captures.length} notes?`,
      message: `Tasks made from ${one ? 'it' : 'them'} are deleted too, on every device.`,
      confirmLabel: one ? 'Delete note' : `Delete ${captures.length} notes`,
      onConfirm: async () => {
        if (await data.deleteCaptures(captures)) ui.stopSelecting()
      },
    })
  }
  const actions: CaptureActions = {
    onToggleTask: (task) => void data.toggleTask(task),
    onEditTask: editTask,
    onAcceptSuggestion: (task) => void data.reviewSuggestion(task, 'accept'),
    onDismissSuggestion: (task) => void data.reviewSuggestion(task, 'dismiss'),
    onCreateTask: (capture) => ui.setEditor({ captureId: capture.id }),
    onRetry: (capture) => void data.retrySuggestions(capture),
    onDelete: (capture) => confirmDeleteCaptures([capture]),
    onToggleSelected: (capture) => ui.toggleSelected(capture.id),
  }
  const editor = ui.editor

  return (
    <div className="app">
      <NavigationRail
        view={ui.view}
        counts={ui.counts}
        status={data.sync.status}
        onSelect={ui.selectView}
        onOpenSettings={openSettings}
        onInstall={installer.status === 'available' ? install : undefined}
      />
      <main className="workspace">
        <WorkspaceHeader
          title={ui.title}
          detail={ui.detail}
          status={data.sync.status}
          searchOpen={ui.searchOpen}
          search={ui.search}
          searchRef={ui.searchRef}
          selecting={ui.selecting}
          onSearchChange={ui.setSearch}
          onOpenSearch={ui.openSearch}
          onCloseSearch={ui.closeSearch}
          onToggleSelecting={ui.toggleSelecting}
          onOpenSettings={openSettings}
        />
        <ViewNavigation view={ui.view} counts={ui.counts} variant="tabs" onSelect={ui.selectView} />
        <div className="workspace-scroll" ref={scrollRef}>
          <div className="column">
            {data.notice && <Notice message={data.notice} onDismiss={() => data.setNotice('')} />}
            {data.loading ? null : ui.view === 'feed' ? (
              <CaptureFeed
                days={ui.feed.days}
                tasksByCapture={ui.feed.tasksByCapture}
                search={ui.search.trim()}
                selectedIds={ui.selecting ? ui.selectedIds : null}
                scrollRef={scrollRef}
                actions={actions}
              />
            ) : ui.view === 'tasks' ? (
              <TaskList
                sections={ui.sections}
                onToggle={(task) => void data.toggleTask(task)}
                onEdit={editTask}
                onTogglePin={(task) => void data.togglePin(task)}
              />
            ) : (
              <ArchiveList items={ui.archive} onRestore={(task) => void data.toggleTask(task)} onDelete={confirmDeleteTask} />
            )}
          </div>
        </div>
        <div className="dock">
          {data.archivedTask && (
            <Toast
              key={data.archivedTask.id}
              message={`“${data.archivedTask.title}” moved to Archive`}
              actionLabel="Undo"
              onAction={data.undoArchive}
              onDismiss={data.dismissArchived}
            />
          )}
          {ui.selecting && (
            <SelectionBar
              count={ui.selectedCaptures.length}
              allSelected={ui.allSelected}
              onToggleAll={ui.toggleSelectAll}
              onDelete={() => confirmDeleteCaptures(ui.selectedCaptures)}
              onCancel={ui.stopSelecting}
            />
          )}
          <Composer inputRef={ui.composerRef} dictation={dictation} hidden={ui.selecting} onSend={(text) => send(text, 'text')} />
        </div>
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
      {ui.settingsOpen && (
        <SettingsDialog
          appearance={appearance.appearance}
          appearanceSaveFailed={appearance.saveFailed}
          status={data.sync.status}
          message={data.sync.message}
          countUnsynced={data.sync.unsyncedChangeCount}
          installStatus={installer.status}
          onInstall={install}
          onAppearanceChange={appearance.chooseAppearance}
          onSignOut={data.sync.signOut}
          onClose={() => ui.setSettingsOpen(false)}
        />
      )}
      <div className="sr-only" role="status" aria-live="polite">
        {data.announcement}
      </div>
    </div>
  )
}

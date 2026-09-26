import { Pencil, Plus } from 'lucide-react'
import { useRef } from 'react'
import ConfirmDialog from '../../components/app/ConfirmDialog'
import NavigationRail from '../../components/app/NavigationRail'
import Notice from '../../components/app/Notice'
import SettingsDialog from '../../components/app/SettingsDialog'
import Tabs, { tabId } from '../../components/app/Tabs'
import Toast from '../../components/app/Toast'
import ViewNavigation from '../../components/app/ViewNavigation'
import WorkspaceHeader, { type HeaderAction } from '../../components/app/WorkspaceHeader'
import SignInScreen from '../../components/auth/SignInScreen'
import ComingUp from '../../components/calendar/ComingUp'
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
import { useSchedule } from '../../shared/hooks/useSchedule'
import { useTaskSet } from '../../shared/hooks/useTaskSet'
import { useWorkspaceView } from '../../shared/hooks/useWorkspaceView'
import type { Capture, Task } from '../../shared/types/task'
import { COMING_UP_COUNT } from '../../shared/utils/calendarView'
import CalendarScreen from './CalendarScreen'
import MeetingsScreen from './MeetingsScreen'

const TASKS_PANEL = 'tasks-panel'

export default function TaskSetScreen() {
  const appearance = useAppearance()
  const installer = useInstallPrompt()
  const data = useTaskSet()
  const schedule = useSchedule(data)
  const ui = useWorkspaceView(data.workspace)
  const scrollRef = useRef<HTMLDivElement>(null)

  /** A note shows itself in Notes; calendar and meeting entries stay where they were added. */
  const send = (text: string, kind: Capture['kind']) => {
    const { target } = ui.composer
    if (target.kind === 'note') ui.showFeed()
    return schedule.send(target, text, kind)
  }
  const dictation = useDictation((text) => void send(text, 'voice'))

  if (data.sync.status === 'signed-out') return <SignInScreen onSignIn={data.sync.signIn} />

  const toggleTask = (task: Task) => void data.toggleTask(task)
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
    onToggleTask: toggleTask,
    onEditTask: editTask,
    onAcceptSuggestion: (task) => void data.reviewSuggestion(task, 'accept'),
    onDismissSuggestion: (task) => void data.reviewSuggestion(task, 'dismiss'),
    onCreateTask: (capture) => ui.setEditor({ captureId: capture.id }),
    onRetry: (capture) => void data.retrySuggestions(capture),
    onDelete: (capture) => confirmDeleteCaptures([capture]),
    onToggleSelected: (capture) => ui.toggleSelected(capture.id),
  }
  const editor = ui.editor
  const openMeeting = ui.view === 'meetings' ? ui.meetings.meeting : null
  const headerAction: HeaderAction | undefined =
    ui.view !== 'meetings'
      ? undefined
      : openMeeting
        ? { label: 'Edit meeting', icon: Pencil, onClick: () => ui.meetings.editMeeting(openMeeting.id) }
        : { label: 'New meeting', icon: Plus, onClick: ui.meetings.startNew }
  const upcoming = ui.view === 'feed' && !ui.searchOpen && !ui.selecting ? ui.calendar.upcoming.slice(0, COMING_UP_COUNT) : []

  function content() {
    switch (ui.view) {
      case 'feed':
        return (
          <CaptureFeed
            days={ui.feed.days}
            tasksByCapture={ui.feed.tasksByCapture}
            search={ui.search.trim()}
            selectedIds={ui.selecting ? ui.selectedIds : null}
            scrollRef={scrollRef}
            actions={actions}
          />
        )
      case 'tasks':
      case 'archive':
        return (
          <div role="tabpanel" id={TASKS_PANEL} aria-labelledby={tabId(ui.view)}>
            {ui.view === 'tasks' ? (
              <TaskList sections={ui.sections} onToggle={toggleTask} onEdit={editTask} onTogglePin={(task) => void data.togglePin(task)} />
            ) : (
              <ArchiveList items={ui.archive} onRestore={toggleTask} onDelete={confirmDeleteTask} />
            )}
          </div>
        )
      case 'calendar':
        return (
          <CalendarScreen
            calendar={ui.calendar}
            today={ui.today}
            confirm={ui.setConfirmation}
            onFocusComposer={ui.focusComposer}
            onOpenMeeting={ui.openMeetingDay}
            onToggleTask={toggleTask}
            onEditTask={editTask}
            onSaveEvent={schedule.saveEvent}
            onDeleteEvent={schedule.deleteEvent}
          />
        )
      case 'meetings':
        return (
          <MeetingsScreen
            meetings={ui.meetings}
            today={ui.today}
            confirm={ui.setConfirmation}
            onSaveMeeting={schedule.saveMeeting}
            onDeleteMeeting={schedule.deleteMeeting}
            onDeleteNote={schedule.deleteMeetingNote}
          />
        )
    }
  }

  return (
    <div className="app">
      <NavigationRail
        section={ui.section}
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
          back={openMeeting ? { label: 'Meetings', onClick: ui.meetings.closeMeeting } : undefined}
          action={headerAction}
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
        <ViewNavigation section={ui.section} counts={ui.counts} variant="tabs" onSelect={ui.selectView} />
        {ui.section === 'tasks' && (
          <Tabs label="Tasks" tabs={ui.taskTabs} selected={ui.view === 'archive' ? 'archive' : 'tasks'} panelId={TASKS_PANEL} onSelect={ui.selectView} />
        )}
        {upcoming.length > 0 && <ComingUp items={upcoming} onOpen={ui.openCalendarDay} />}
        <div className="workspace-scroll" ref={scrollRef}>
          <div className="column">
            {data.notice && <Notice message={data.notice} onDismiss={() => data.setNotice('')} />}
            {!data.loading && content()}
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
          <Composer
            inputRef={ui.composerRef}
            dictation={dictation}
            placeholder={ui.composer.placeholder}
            label={ui.composer.label}
            hidden={ui.selecting}
            onSend={(text) => send(text, 'text')}
          />
        </div>
      </main>

      {editor && (
        <TaskEditor
          key={editor.task?.id ?? editor.captureId}
          editor={editor}
          capture={data.workspace.captures.find((capture) => capture.id === editor.captureId)}
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

import { useEffect, useRef, useState } from 'react'
import {
  ArrowUp,
  CalendarDays,
  CalendarClock,
  Check,
  CircleHelp,
  Inbox,
  LayoutList,
  Plus,
  Search,
  X,
} from 'lucide-react'
import {
  createId,
  deleteTask,
  loadData,
  saveCapture,
  saveTask,
  type Capture,
  type Task,
} from './data'

type View = 'feed' | 'today' | 'inbox' | 'upcoming'
type Editor = { captureId: string; task?: Task }
type TaskInput = { title: string; dueAt: string | null; pinned: boolean }

const navigation: { id: View; label: string; icon: typeof LayoutList }[] = [
  { id: 'feed', label: 'Feed', icon: LayoutList },
  { id: 'today', label: 'Today', icon: CalendarDays },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'upcoming', label: 'Upcoming', icon: CalendarClock },
]

function dayKey(value: string): string {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function dayLabel(value: string): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (dayKey(value) === dayKey(today.toISOString())) return 'Today'
  if (dayKey(value) === dayKey(yesterday.toISOString())) return 'Yesterday'
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(value))
}

function timeLabel(value: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function dateTimeLabel(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(value))
}

function toLocalInput(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  const pad = (number: number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

function tasksForView(tasks: Task[], view: View): Task[] {
  const active = tasks.filter((task) => !task.completedAt)
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)
  const filtered = active.filter((task) => {
    if (view === 'today') return task.pinned || (!!task.dueAt && new Date(task.dueAt) <= endOfToday)
    if (view === 'inbox') return !task.pinned && !task.dueAt
    return !task.pinned && !!task.dueAt && new Date(task.dueAt) > endOfToday
  })
  return filtered.sort((a, b) => {
    if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt)
    if (a.dueAt) return -1
    if (b.dueAt) return 1
    return b.createdAt.localeCompare(a.createdAt)
  })
}

function AudioClip({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    const nextUrl = URL.createObjectURL(blob)
    setUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [blob])

  return url ? <audio className="audio-player" controls preload="metadata" src={url} aria-label="Voice recording" /> : null
}

function TaskRow({ task, onToggle, onEdit, compact = false }: {
  task: Task
  onToggle: (task: Task) => void
  onEdit: (task: Task) => void
  compact?: boolean
}) {
  return (
    <div className={`task-row ${compact ? 'task-row-compact' : ''} ${task.completedAt ? 'is-complete' : ''}`}>
      <button className="task-check" type="button" onClick={() => onToggle(task)} aria-label={`${task.completedAt ? 'Reopen' : 'Complete'} ${task.title}`}>
        {task.completedAt ? <Check size={13} strokeWidth={2.5} /> : null}
      </button>
      <button className="task-body" type="button" onClick={() => onEdit(task)}>
        <span className="task-title">{task.title}</span>
        {(task.dueAt || task.pinned) && (
          <span className="task-meta">
            {task.dueAt && <span>Due {dateTimeLabel(task.dueAt)}</span>}
            {task.pinned && <span>On Today</span>}
          </span>
        )}
      </button>
    </div>
  )
}

function TaskEditor({ editor, capture, onClose, onSave, onDelete }: {
  editor: Editor
  capture: Capture | undefined
  onClose: () => void
  onSave: (input: TaskInput) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [title, setTitle] = useState(editor.task?.title ?? (capture?.text || '').slice(0, 120))
  const [dueAt, setDueAt] = useState(toLocalInput(editor.task?.dueAt ?? null))
  const [pinned, setPinned] = useState(editor.task?.pinned ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    titleRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
      if (event.key !== 'Tab' || !dialogRef.current) return
      const controls = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'))
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown); previousFocus?.focus() }
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      await onSave({ title: title.trim(), dueAt: fromLocalInput(dueAt), pinned })
    } catch {
      setError('Could not save the task. Please try again.')
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm('Remove this task? The original capture will stay.')) return
    setBusy(true)
    try { await onDelete() } catch {
      setError('Could not remove the task. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} className="task-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="dialog-head">
          <div>
            <div className="eyebrow">TASK</div>
            <h2 id="dialog-title">{editor.task ? 'Edit task' : 'Make a task'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="task-title">What needs doing?</label>
          <input ref={titleRef} id="task-title" className="text-field" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Task name" maxLength={200} required />
          <div className="field-grid">
            <div>
              <label className="field-label" htmlFor="task-due">Due date <span>optional</span></label>
              <input id="task-due" className="text-field" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </div>
          </div>
          <label className="pin-row"><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} /> Keep on Today</label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            {editor.task && <button className="text-button danger" type="button" onClick={remove} disabled={busy}>Remove task</button>}
            <div className="dialog-action-right">
              <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
              <button className="primary-button" type="submit" disabled={busy || !title.trim()}>{busy ? 'Saving…' : 'Save task'}</button>
            </div>
          </div>
        </form>
      </section>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState<View>('feed')
  const [captures, setCaptures] = useState<Capture[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [composer, setComposer] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [editingTranscriptId, setEditingTranscriptId] = useState<string | null>(null)
  const [transcriptDraft, setTranscriptDraft] = useState('')
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const savingRef = useRef(false)
  const pendingTaskIdsRef = useRef(new Set<string>())

  useEffect(() => {
    let active = true
    loadData().then((data) => {
      if (!active) return
      setCaptures(data.captures)
      setTasks(data.tasks)
      setLoading(false)
      requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight })
    }).catch(() => {
      if (!active) return
      setError('Local storage is unavailable. Check your browser settings, then reload.')
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (editor) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setView('feed')
        setSearchOpen(true)
        requestAnimationFrame(() => searchRef.current?.focus())
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        setView('feed')
        composerRef.current?.focus()
      }
      if (event.key === 'Escape' && !editor) { setSearchOpen(false); setSearch('') }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editor])

  async function sendCapture() {
    const text = composer.trim()
    if (!text || loading || savingRef.current) return
    savingRef.current = true
    const capture: Capture = { id: createId(), kind: 'text', text, createdAt: new Date().toISOString() }
    setCaptures((current) => [...current, capture])
    setComposer('')
    setView('feed')
    setSearch('')
    setSearchOpen(false)
    setError('')
    requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight })
    try {
      await saveCapture(capture)
      setAnnouncement('Capture saved in this browser')
    } catch {
      setCaptures((current) => current.filter((item) => item.id !== capture.id))
      setComposer((current) => current ? `${text}\n${current}` : text)
      setError('Could not save this capture. Your text is back in the composer. Try again.')
    } finally {
      savingRef.current = false
      composerRef.current?.focus()
    }
  }

  async function saveEditedTask(input: TaskInput) {
    if (!editor) return
    const now = new Date().toISOString()
    const task: Task = editor.task
      ? { ...editor.task, ...input, updatedAt: now }
      : { id: createId(), captureId: editor.captureId, ...input, reminderAt: null, createdAt: now, updatedAt: now, completedAt: null }
    await saveTask(task)
    setTasks((current) => editor.task ? current.map((item) => item.id === task.id ? task : item) : [...current, task])
    setEditor(null)
    setAnnouncement(editor.task ? 'Task updated' : 'Task added')
  }

  async function removeEditedTask() {
    if (!editor?.task) return
    await deleteTask(editor.task.id)
    setTasks((current) => current.filter((task) => task.id !== editor.task?.id))
    setEditor(null)
    setAnnouncement('Task removed; capture kept')
  }

  async function toggleTask(task: Task) {
    if (pendingTaskIdsRef.current.has(task.id)) return
    pendingTaskIdsRef.current.add(task.id)
    const next = { ...task, completedAt: task.completedAt ? null : new Date().toISOString(), updatedAt: new Date().toISOString() }
    setTasks((current) => current.map((item) => item.id === task.id ? next : item))
    try {
      await saveTask(next)
      setAnnouncement(next.completedAt ? 'Task completed' : 'Task reopened')
    } catch {
      setTasks((current) => current.map((item) => item.id === task.id ? task : item))
      setError('Could not update the task. Please try again.')
    } finally {
      pendingTaskIdsRef.current.delete(task.id)
    }
  }

  async function saveTranscript(capture: Capture) {
    const next = { ...capture, text: transcriptDraft.trim() }
    try {
      await saveCapture(next)
      setCaptures((current) => current.map((item) => item.id === capture.id ? next : item))
      setEditingTranscriptId(null)
      setTranscriptDraft('')
    } catch { setError('Could not save the transcript. Please try again.') }
  }

  const visibleCaptures = captures.filter((capture) => {
    const term = search.trim().toLowerCase()
    if (!term) return true
    return capture.text.toLowerCase().includes(term) || tasks.some((task) => task.captureId === capture.id && task.title.toLowerCase().includes(term))
  })
  const viewTasks = view === 'feed' ? [] : tasksForView(tasks, view)
  const counts = {
    today: tasksForView(tasks, 'today').length,
    inbox: tasksForView(tasks, 'inbox').length,
    upcoming: tasksForView(tasks, 'upcoming').length,
  }
  const viewTitle = view === 'feed' ? 'Feed' : navigation.find((item) => item.id === view)?.label

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Check size={17} strokeWidth={2.7} /></span><span>Task Set</span></div>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="nav-list" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} type="button" aria-current={view === id ? 'page' : undefined} onClick={() => { setView(id); if (id !== 'feed') { setSearch(''); setSearchOpen(false) } }}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              {id !== 'feed' && counts[id] > 0 && <span className="nav-count">{counts[id]}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="storage-note"><span className={`status-dot ${online ? '' : 'offline'}`} /><span>{online ? 'Saved in this browser' : 'Offline · saved here'}</span></div>
          <div className="sidebar-hint">Private to this browser for now.</div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><Check size={15} strokeWidth={2.7} /></span> Task Set</div>
          <div className="topbar-path">Task Set</div>
          <div className="topbar-actions">
            {searchOpen && view === 'feed' ? (
              <div className="search-field"><Search size={17} /><input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search captures" aria-label="Search captures" /><button type="button" onClick={() => { setSearchOpen(false); setSearch('') }} aria-label="Close search"><X size={16} /></button></div>
            ) : (
              <button className="icon-button search-trigger" type="button" onClick={() => { setView('feed'); setSearchOpen(true); requestAnimationFrame(() => searchRef.current?.focus()) }} aria-label="Search captures" title="Search captures (⌘K)"><Search size={19} /></button>
            )}
          </div>
        </header>

        <div className="content-scroll" ref={scrollRef}>
          <div className="content-inner">
            <div className="page-heading">
              
              <h1>{viewTitle}</h1>
              <p>{view === 'feed' ? 'A place for everything on your mind.' : view === 'today' ? 'Due today, overdue, and pinned.' : view === 'inbox' ? 'Tasks waiting for a date.' : 'Tasks with a future due date.'}</p>
            </div>

            {error && <div className="error-banner" role="alert"><CircleHelp size={18} /><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss error"><X size={16} /></button></div>}
            {loading ? <div className="loading-state">Opening your space…</div> : view === 'feed' ? (
              visibleCaptures.length ? (
                <div className="capture-list">
                  {visibleCaptures.map((capture, index) => {
                    const captureTasks = tasks.filter((task) => task.captureId === capture.id)
                    const showDay = index === 0 || dayKey(visibleCaptures[index - 1].createdAt) !== dayKey(capture.createdAt)
                    return (
                      <div key={capture.id}>
                        {showDay && <div className="day-divider"><span>{dayLabel(capture.createdAt)}</span></div>}
                        <article className="capture-row">
                          
                          <div className="capture-content">
                            <div className="capture-byline"><time dateTime={capture.createdAt}>{timeLabel(capture.createdAt)}</time>{capture.kind === 'voice' && <span className="voice-label">VOICE</span>}</div>
                            {capture.kind === 'text' ? <p className="capture-text">{capture.text}</p> : (
                              <div className="voice-content">
                                {capture.audio && <AudioClip blob={capture.audio} />}
                                {editingTranscriptId === capture.id ? (
                                  <div className="transcript-form"><textarea value={transcriptDraft} onChange={(event) => setTranscriptDraft(event.target.value)} placeholder="Write what you said…" aria-label="Transcript" rows={3} /><div><button className="text-button" type="button" onClick={() => setEditingTranscriptId(null)}>Cancel</button><button className="small-primary" type="button" onClick={() => void saveTranscript(capture)}>Save text</button></div></div>
                                ) : capture.text ? <p className="capture-text transcript-text">{capture.text} <button className="inline-link" type="button" onClick={() => { setEditingTranscriptId(capture.id); setTranscriptDraft(capture.text) }}>Edit text</button></p> : <button className="inline-link add-transcript" type="button" onClick={() => { setEditingTranscriptId(capture.id); setTranscriptDraft('') }}>Add text to this recording</button>}
                              </div>
                            )}
                            {captureTasks.length > 0 && <div className="linked-tasks">{captureTasks.map((task) => <TaskRow key={task.id} compact task={task} onToggle={(item) => void toggleTask(item)} onEdit={(item) => setEditor({ captureId: item.captureId, task: item })} />)}</div>}
                            <button className="add-task-button" type="button" onClick={() => setEditor({ captureId: capture.id })}><Plus size={15} /> Add task</button>
                          </div>
                        </article>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="empty-state"><div className="empty-line" /><h2>{search ? 'No captures found' : 'Start with a thought.'}</h2><p>{search ? 'Try a different word.' : 'Type something below. You can make it a task whenever you are ready.'}</p></div>
              )
            ) : viewTasks.length ? (
              <div className="task-list">{viewTasks.map((task) => <TaskRow key={task.id} task={task} onToggle={(item) => void toggleTask(item)} onEdit={(item) => setEditor({ captureId: item.captureId, task: item })} />)}</div>
            ) : (
              <div className="empty-state"><div className="empty-line" /><h2>{view === 'today' ? 'A clear day.' : view === 'inbox' ? 'All caught up.' : 'Nothing coming up.'}</h2><p>{view === 'today' ? 'Pin a task to Today or give it a due date.' : view === 'inbox' ? 'New tasks without a date will appear here.' : 'Tasks with a future due date will appear here.'}</p></div>
            )}
          </div>
        </div>

        <div className="composer-wrap">
          <div className="composer-box">
            <textarea ref={composerRef} rows={1} value={composer} onChange={(event) => setComposer(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void sendCapture() } }} placeholder="Write a thought, task, or anything…" aria-label="New capture" />
            <div className="composer-controls">
              <span className="composer-hint">Enter to send <span>·</span> Shift + Enter for a new line</span>
              <div className="composer-buttons">
                <button className="send-button" type="button" onClick={() => void sendCapture()} disabled={!composer.trim() || loading} aria-label="Save capture"><ArrowUp size={19} strokeWidth={2.1} /></button>
              </div>
            </div>
          </div>
          <div className="composer-foot">Only in this browser for now <span>⌘N to capture</span></div>
        </div>
      </main>

      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
      {editor && <TaskEditor key={editor.task?.id ?? editor.captureId} editor={editor} capture={captures.find((capture) => capture.id === editor.captureId)} onClose={() => setEditor(null)} onSave={saveEditedTask} onDelete={removeEditedTask} />}
    </div>
  )
}

import {
  CalendarDays,
  CalendarClock,
  Check,
  CircleHelp,
  Inbox,
  LayoutList,
  Search,
  X,
} from 'lucide-react'
import CaptureComposer from '../CaptureComposer'
import TaskEditor from '../TaskEditor'
import TaskSetContent from '../TaskSetContent'
import type { useTaskSet } from '../../../shared/hooks/useTaskSet'
import type { View } from '../../../shared/types/task'

const navigation: { id: View; label: string; icon: typeof LayoutList }[] = [
  { id: 'feed', label: 'Feed', icon: LayoutList },
  { id: 'today', label: 'Today', icon: CalendarDays },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'upcoming', label: 'Upcoming', icon: CalendarClock },
]

export default function TaskSetWorkspace({
  model,
}: {
  model: ReturnType<typeof useTaskSet>
}) {
  const {
    view,
    setView,
    captures,
    error,
    setError,
    announcement,
    searchOpen,
    setSearchOpen,
    search,
    setSearch,
    editor,
    setEditor,
    online,
    searchRef,
    scrollRef,
    saveEditedTask,
    removeEditedTask,
    counts,
  } = model
  const viewTitle = navigation.find((item) => item.id === view)?.label

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Check size={17} strokeWidth={2.7} />
          </span>
          <span>Task Set</span>
        </div>
        <nav className="nav-list" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? 'active' : ''}`}
              type="button"
              aria-current={view === id ? 'page' : undefined}
              onClick={() => {
                setView(id)
                if (id !== 'feed') {
                  setSearch('')
                  setSearchOpen(false)
                }
              }}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {id !== 'feed' && counts[id] > 0 && (
                <span className="nav-count">{counts[id]}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="storage-note">
            <span className={`status-dot ${online ? '' : 'offline'}`} />
            <span>
              {online ? 'Saved in this browser' : 'Offline · saved here'}
            </span>
          </div>
          <div className="sidebar-hint">Private to this browser for now.</div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark">
              <Check size={15} strokeWidth={2.7} />
            </span>{' '}
            Task Set
          </div>
          <div className="topbar-path">Task Set</div>
          <div className="topbar-actions">
            {searchOpen && view === 'feed' ? (
              <div className="search-field">
                <Search size={17} />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search captures"
                  aria-label="Search captures"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(false)
                    setSearch('')
                  }}
                  aria-label="Close search"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                className="icon-button search-trigger"
                type="button"
                onClick={() => {
                  setView('feed')
                  setSearchOpen(true)
                  requestAnimationFrame(() => searchRef.current?.focus())
                }}
                aria-label="Search captures"
                title="Search captures (⌘K)"
              >
                <Search size={19} />
              </button>
            )}
          </div>
        </header>

        <div className="content-scroll" ref={scrollRef}>
          <div className="content-inner">
            <div className="page-heading">
              <h1>{viewTitle}</h1>
              <p>
                {view === 'feed'
                  ? 'A place for everything on your mind.'
                  : view === 'today'
                    ? 'Due today, overdue, and pinned.'
                    : view === 'inbox'
                      ? 'Tasks waiting for a date.'
                      : 'Tasks with a future due date.'}
              </p>
            </div>

            {error && (
              <div className="error-banner" role="alert">
                <CircleHelp size={18} />
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => setError('')}
                  aria-label="Dismiss error"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <TaskSetContent model={model} />
          </div>
        </div>

        <CaptureComposer model={model} />
      </main>

      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
      {editor && (
        <TaskEditor
          key={editor.task?.id ?? editor.captureId}
          editor={editor}
          capture={captures.find((capture) => capture.id === editor.captureId)}
          onClose={() => setEditor(null)}
          onSave={saveEditedTask}
          onDelete={removeEditedTask}
        />
      )}
    </div>
  )
}

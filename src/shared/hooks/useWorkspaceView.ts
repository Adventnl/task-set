import { useEffect, useMemo, useRef, useState } from 'react'
import type { Capture, Editor, Task, View } from '../types/task'
import { VIEW_LABELS } from '../config/views'
import { dayKey, openTaskCount, selectCaptureData, taskSections, viewDetail } from '../utils/taskView'

const CLOCK_MS = 60_000
const NO_SELECTION: ReadonlySet<string> = new Set()

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

export interface Confirmation {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => Promise<unknown>
}

/** Which view and dialog are open, search, Feed selection, keyboard shortcuts, and the lists they derive. */
export function useWorkspaceView(captures: Capture[], tasks: Task[]) {
  const [view, setView] = useState<View>('feed')
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState(NO_SELECTION)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  // Changes only when the date does, so day labels and Done today roll over after midnight.
  const [today, setToday] = useState(() => dayKey(new Date().toISOString()))

  useEffect(() => {
    const timer = window.setInterval(() => setToday(dayKey(new Date().toISOString())), CLOCK_MS)
    return () => window.clearInterval(timer)
  }, [])

  function openSearch() {
    setView('feed')
    setSearchOpen(true)
    requestAnimationFrame(() => searchRef.current?.focus())
  }

  function closeSearch() {
    setSearchOpen(false)
    setSearch('')
  }

  function startSelecting() {
    setSelectedIds(NO_SELECTION)
    setSelecting(true)
  }

  function stopSelecting() {
    setSelecting(false)
    setSelectedIds(NO_SELECTION)
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  function selectView(next: View) {
    setView(next)
    if (next !== 'feed') {
      closeSearch()
      stopSelecting()
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        openSearch()
      } else if (event.key.toLowerCase() === 'n' && !event.metaKey && !event.ctrlKey && !event.altKey && !isTyping(event.target)) {
        event.preventDefault()
        composerRef.current?.focus()
      } else if (event.key === 'Escape' && searchOpen) {
        closeSearch()
      } else if (event.key === 'Escape' && selecting) {
        stopSelecting()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [searchOpen, selecting])

  const feed = useMemo(() => selectCaptureData(captures, tasks, search), [captures, tasks, search, today])
  // Only messages still on screen count, so a search or another device's deletion never widens a delete.
  const selectedCaptures = useMemo(() => feed.captures.filter((capture) => selectedIds.has(capture.id)), [feed, selectedIds])
  const allSelected = feed.captures.length > 0 && selectedCaptures.length === feed.captures.length
  const sections = useMemo(() => (view === 'tasks' ? taskSections(tasks) : []), [tasks, view, today])
  const taskCount = useMemo(() => openTaskCount(tasks), [tasks])
  const detail = viewDetail(view, search.trim() ? feed.matchCount : null)

  return {
    view,
    selectView,
    showFeed: () => selectView('feed'),
    searchOpen,
    search,
    setSearch,
    openSearch,
    closeSearch,
    selecting,
    /** Undefined when there is nothing to select. */
    toggleSelecting: selecting ? stopSelecting : view === 'feed' && captures.length ? startSelecting : undefined,
    stopSelecting,
    toggleSelected,
    selectedIds,
    selectedCaptures,
    allSelected,
    toggleSelectAll: () => setSelectedIds(allSelected ? NO_SELECTION : new Set(feed.captures.map((capture) => capture.id))),
    title: VIEW_LABELS[view],
    detail,
    editor,
    setEditor,
    settingsOpen,
    setSettingsOpen,
    confirmation,
    setConfirmation,
    composerRef,
    searchRef,
    feed,
    sections,
    taskCount,
  }
}

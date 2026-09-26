import { useEffect, useMemo, useRef, useState } from 'react'
import type { Capture, Editor, Task, View } from '../types/task'
import { VIEW_LABELS } from '../config/views'
import { countsForViews, dayKey, sectionsForView, selectCaptureData, viewDetail } from '../utils/taskView'

const CLOCK_MS = 60_000

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

export interface Confirmation {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => Promise<unknown>
}

/** Which view and dialog are open, search, keyboard shortcuts, and the lists they derive. */
export function useWorkspaceView(captures: Capture[], tasks: Task[]) {
  const [view, setView] = useState<View>('feed')
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  // Changes only when the date does, so Today and Upcoming regroup after midnight.
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

  function selectView(next: View) {
    setView(next)
    if (next !== 'feed') closeSearch()
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
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [searchOpen])

  const feed = useMemo(() => selectCaptureData(captures, tasks, search), [captures, tasks, search, today])
  const sections = useMemo(() => (view === 'feed' ? [] : sectionsForView(tasks, view)), [tasks, view, today])
  const counts = useMemo(() => countsForViews(tasks), [tasks, today])
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
    title: VIEW_LABELS[view],
    detail,
    editor,
    setEditor,
    accountOpen,
    setAccountOpen,
    confirmation,
    setConfirmation,
    composerRef,
    searchRef,
    feed,
    sections,
    counts,
  }
}

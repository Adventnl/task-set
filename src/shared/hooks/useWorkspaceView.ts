import { useEffect, useMemo, useRef, useState } from 'react'
import { sectionOf, TASK_TAB_LABELS, VIEW_LABELS, type Section } from '../config/views'
import type { WorkspaceData } from '../types/sync'
import type { ComposerTarget, Editor, View } from '../types/task'
import { dateKey, longDayLabel, shortDayLabel } from '../utils/dates'
import { scheduleLabel } from '../utils/meetingView'
import { archivedTasks, openTaskCount, selectCaptureData, taskSections, viewDetail } from '../utils/taskView'
import { useCalendarView } from './useCalendarView'
import { useMeetingsView } from './useMeetingsView'

const CLOCK_MS = 60_000
const NO_SELECTION: ReadonlySet<string> = new Set()
const NOTE_TARGET: ComposerTarget = { kind: 'note' }
const NOTE_COMPOSER = { target: NOTE_TARGET, placeholder: 'Write a note…', label: 'New note' }

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

export interface Confirmation {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => Promise<unknown>
}

/**
 * Which view and dialog are open, search, note selection, keyboard shortcuts, where the composer
 * sends, and the lists each view derives. The calendar and meetings keep their own state.
 */
export function useWorkspaceView(data: WorkspaceData) {
  const { captures, tasks } = data
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
  // Changes only when the date does, so day labels, countdowns, and the Archive roll over after midnight.
  const [today, setToday] = useState(() => dateKey(new Date()))
  const calendar = useCalendarView(data, today)
  const meetings = useMeetingsView(data, today)

  useEffect(() => {
    const timer = window.setInterval(() => setToday(dateKey(new Date())), CLOCK_MS)
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

  function show(next: View) {
    setView(next)
    if (next !== 'feed') {
      closeSearch()
      stopSelecting()
    }
  }

  /** Choosing Meetings while it is open goes back to the list. */
  function selectView(next: View) {
    if (next === 'meetings' && view === 'meetings') meetings.closeMeeting()
    show(next)
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
  const sections = useMemo(() => (view === 'tasks' ? taskSections(tasks) : []), [tasks, view])
  const archive = useMemo(() => archivedTasks(tasks), [tasks, today])
  const taskCount = useMemo(() => openTaskCount(tasks), [tasks])
  const counts: Record<Section, number> = {
    feed: captures.length,
    tasks: taskCount,
    calendar: calendar.upcoming.length,
    meetings: data.meetings.length,
  }
  const shownMeeting = view === 'meetings' ? meetings.meeting : null

  /** On the calendar the composer adds to the selected day; in a meeting, to the day on screen. */
  function composerFor() {
    if (view === 'calendar') {
      const day = calendar.selected
      const target: ComposerTarget = { kind: 'event', date: day }
      return { target, placeholder: day === today ? 'Add to today…' : `Add to ${shortDayLabel(day)}…`, label: `Add to ${longDayLabel(day, today)}` }
    }
    if (shownMeeting && meetings.detail) {
      const { date, next } = meetings.detail
      const target: ComposerTarget = { kind: 'meetingNote', meetingId: shownMeeting.id, date }
      return {
        target,
        placeholder: date === next ? 'Add to the next meeting…' : `Add to ${shortDayLabel(date)}…`,
        label: `Note for ${shownMeeting.title} on ${longDayLabel(date, today)}`,
      }
    }
    return NOTE_COMPOSER
  }

  return {
    view,
    section: sectionOf(view),
    selectView,
    showFeed: () => show('feed'),
    openCalendarDay: (date: string) => {
      show('calendar')
      calendar.select(date)
    },
    openMeetingDay: (id: string, date: string) => {
      show('meetings')
      meetings.openMeeting(id, date)
    },
    today,
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
    title: shownMeeting ? shownMeeting.title : VIEW_LABELS[sectionOf(view)],
    detail: shownMeeting
      ? scheduleLabel(shownMeeting, today)
      : viewDetail(view, {
          notes: captures.length,
          openTasks: taskCount,
          matches: search.trim() ? feed.matchCount : null,
          upcoming: calendar.upcoming.length,
          meetings: data.meetings.length,
        }),
    taskTabs: [
      { id: 'tasks' as const, label: TASK_TAB_LABELS.tasks, count: taskCount },
      { id: 'archive' as const, label: TASK_TAB_LABELS.archive, count: archive.length },
    ],
    composer: composerFor(),
    focusComposer: () => composerRef.current?.focus(),
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
    archive,
    counts,
    calendar,
    meetings,
  }
}

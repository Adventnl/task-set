import { useMemo, useState } from 'react'
import type { WorkspaceData } from '../types/sync'
import { calendarItems, firstDayOfWeek, monthLabel, monthWeeks, upcomingEvents, weekdayLabels } from '../utils/calendarView'
import { addMonths, monthStart } from '../utils/dates'

/**
 * The calendar's selected day, the month around it, and what is on each day. With no day picked,
 * the selection follows today, so it rolls over at midnight.
 */
export function useCalendarView({ events, meetings, meetingNotes, tasks }: WorkspaceData, today: string) {
  const [picked, setPicked] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const selected = picked ?? today
  const month = monthStart(selected)
  const weekStart = useMemo(() => firstDayOfWeek(navigator.language), [])
  const weekdays = useMemo(() => weekdayLabels(weekStart), [weekStart])
  const weeks = useMemo(() => monthWeeks(month, weekStart), [month, weekStart])
  const items = useMemo(
    () => calendarItems({ events, meetings, meetingNotes, tasks }, weeks[0][0], weeks[weeks.length - 1][6]),
    [events, meetings, meetingNotes, tasks, weeks],
  )
  const upcoming = useMemo(() => upcomingEvents(events, today), [events, today])

  const select = (date: string) => setPicked(date === today ? null : date)

  /** The previous or next month opens on its first day, or on today in the current month. */
  function showMonth(step: 1 | -1) {
    const first = addMonths(month, step)
    select(first === monthStart(today) ? today : first)
  }

  return {
    selected,
    monthLabel: monthLabel(month),
    weekdays,
    weeks,
    items,
    dayItems: items.get(selected) ?? [],
    upcoming,
    select,
    showMonth,
    showToday: () => setPicked(null),
    // Found by id, so an event deleted on another device closes its editor.
    editing: editingId ? (events.find((event) => event.id === editingId) ?? null) : null,
    editEvent: (id: string) => setEditingId(id),
    closeEditor: () => setEditingId(null),
  }
}

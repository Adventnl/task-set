import { useMemo, useState } from 'react'
import type { WorkspaceData } from '../types/sync'
import { meetingDetail, meetingSections, previousMeetingSections } from '../utils/meetingView'

/**
 * The meeting list, the open meeting and the day it shows, and the meeting editor. Meetings are
 * found by id, so one deleted on another device closes its page and editor.
 */
export function useMeetingsView({ meetings, meetingNotes }: WorkspaceData, today: string) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [tab, setTab] = useState<'all' | 'past'>('all')
  /** The meeting day on screen; null shows the next meeting. */
  const [picked, setPicked] = useState<string | null>(null)
  /** Null while closed; `meetingId` is null while adding a meeting. */
  const [editor, setEditor] = useState<{ meetingId: string | null } | null>(null)

  const sections = useMemo(() => meetingSections(meetings, meetingNotes, today), [meetings, meetingNotes, today])
  const previous = useMemo(() => previousMeetingSections(meetings, meetingNotes, today), [meetings, meetingNotes, today])
  const meeting = openId ? (meetings.find((item) => item.id === openId) ?? null) : null
  const detail = useMemo(() => meeting && meetingDetail(meeting, meetingNotes, picked, today), [meeting, meetingNotes, picked, today])
  const editing = editor?.meetingId ? (meetings.find((item) => item.id === editor.meetingId) ?? null) : null

  function openMeeting(id: string, date: string | null = null) {
    setOpenId(id)
    setPicked(date)
  }

  return {
    sections: tab === 'past' ? previous : sections,
    tab,
    setTab,
    meeting,
    detail,
    openMeeting,
    closeMeeting: () => {
      setOpenId(null)
      setPicked(null)
    },
    /** Picking the next meeting's day follows the next meeting again. */
    pickDate: (date: string) => setPicked(date === detail?.next ? null : date),
    editor: editor && (editor.meetingId === null || editing) ? { meeting: editing } : null,
    startNew: () => setEditor({ meetingId: null }),
    editMeeting: (id: string) => setEditor({ meetingId: id }),
    closeEditor: () => setEditor(null),
  }
}

import type { View } from '../types/task'

/** The sidebar and phone navigation. The Archive is a tab of Tasks, so it is not a section of its own. */
export type Section = Exclude<View, 'archive'>
/** The sidebar and phone navigation. The Archive is a tab of Notes and Tasks, so it is not a section of its own. */
export type Section = Exclude<View, 'archive' | 'noteArchive'>

/** Matches the stylesheet's narrow-screen breakpoint, where the sidebar becomes a drawer. */
export const NARROW_SCREEN_QUERY = '(max-width: 760px)'

export const SECTIONS: readonly Section[] = ['feed', 'tasks', 'calendar', 'meetings', 'github']

export const VIEW_LABELS: Record<View, string> = {
  feed: 'Notes',
  noteArchive: 'Archive',
  tasks: 'Tasks',
  archive: 'Archive',
  calendar: 'Calendar',
  meetings: 'Meetings',
  github: 'GitHub',
}

/** The tabs of the Notes section. */
export const NOTE_TAB_LABELS = { feed: 'Notes', noteArchive: 'Archive' } as const

/** The tabs of the Tasks section. */
export const TASK_TAB_LABELS = { tasks: 'Open', archive: 'Archive' } as const

export function sectionOf(view: View): Section {
  return view === 'archive' ? 'tasks' : view
  if (view === 'noteArchive') return 'feed'
  if (view === 'archive') return 'tasks'
  return view
}

import type { View } from '../types/task'

/** The sidebar and phone navigation. The Archive is a tab of Tasks, so it is not a section of its own. */
export type Section = Exclude<View, 'archive'>

export const SECTIONS: readonly Section[] = ['feed', 'tasks', 'calendar', 'meetings']

export const VIEW_LABELS: Record<View, string> = {
  feed: 'Notes',
  tasks: 'Tasks',
  archive: 'Archive',
  calendar: 'Calendar',
  meetings: 'Meetings',
}

/** The tabs of the Tasks section. */
export const TASK_TAB_LABELS = { tasks: 'Open', archive: 'Archive' } as const

export function sectionOf(view: View): Section {
  return view === 'archive' ? 'tasks' : view
}

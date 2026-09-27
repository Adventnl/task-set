/** Server-owned AI state. `null` means the server has not received the capture yet. */
export type AiStatus = 'queued' | 'ready' | 'failed'

export interface Capture {
  id: string
  kind: 'text' | 'voice'
  text: string
  /** IANA time zone used to interpret phrases such as "tomorrow morning". */
  timeZone: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  ai: AiStatus | null
}

export interface Task {
  id: string
  captureId: string
  title: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  dueAt: string | null
  reminderAt: string | null
  pinned: boolean
  completedAt: string | null
  suggestionStatus: 'suggested' | 'dismissed' | null
}

/** `feed` is the Notes view; `archive` is the Tasks tab that holds completed tasks until they expire. */
export type View = 'feed' | 'tasks' | 'archive' | 'calendar' | 'meetings'
/** Where the composer's words go: a new note, a calendar day, or a meeting day's notes. */
export type ComposerTarget = { kind: 'note' } | { kind: 'event'; date: string } | { kind: 'meetingNote'; meetingId: string; date: string }
export type Editor = { captureId: string; task?: Task }
export type TaskInput = {
  title: string
  dueAt: string | null
  reminderAt: string | null
  pinned: boolean
}

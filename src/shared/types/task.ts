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

export type View = 'feed' | 'tasks'
export type Editor = { captureId: string; task?: Task }
export type TaskInput = {
  title: string
  dueAt: string | null
  reminderAt: string | null
  pinned: boolean
}

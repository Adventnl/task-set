export interface Capture {
  id: string
  kind: 'text' | 'voice'
  text: string
  createdAt: string
  audio?: Blob
  mimeType?: string
  aiStatus?: 'saved' | 'ready' | 'needs-retry'
}

export interface Task {
  id: string
  captureId: string
  title: string
  createdAt: string
  updatedAt: string
  dueAt: string | null
  reminderAt: string | null
  pinned: boolean
  completedAt: string | null
  suggestionStatus?: 'suggested' | 'dismissed' | null
}

export type View = 'feed' | 'today' | 'inbox' | 'upcoming'
export type Editor = { captureId: string; task?: Task }
export type TaskInput = {
  title: string
  dueAt: string | null
  reminderAt: string | null
  pinned: boolean
}

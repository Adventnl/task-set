/** A meeting that happens once or every week. Its days and times are local, with no time zone. */
export interface Meeting {
  id: string
  title: string
  /** The first (or only) meeting day, YYYY-MM-DD. A weekly meeting repeats on this weekday. */
  date: string
  /** Start time, HH:mm, or null when only the day is set. */
  time: string | null
  repeat: 'weekly' | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

/** A note for one meeting day: something to bring up, or what was said. */
export interface MeetingNote {
  id: string
  meetingId: string
  /** The meeting day it belongs to, YYYY-MM-DD. */
  date: string
  text: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type MeetingInput = Pick<Meeting, 'title' | 'date' | 'time' | 'repeat'>

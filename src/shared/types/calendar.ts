/** Something to do or remember on a day. It has a date but no time, reminder, or time zone. */
export interface CalendarEvent {
  id: string
  /** Local calendar date, YYYY-MM-DD. */
  date: string
  text: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type EventInput = Pick<CalendarEvent, 'date' | 'text'>

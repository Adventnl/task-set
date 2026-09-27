import type { CalendarEvent, EventInput } from '../shared/types/calendar'
import type { SyncRecord } from '../shared/types/sync'
import { markDeleted } from '../shared/utils/records'
import { createId, saveLocal } from './localDataService'

// Calendar events save on this device first, like every other change, and sync afterwards.

const eventRecord = (value: CalendarEvent): SyncRecord => ({ type: 'event', value })

export function createEvent(input: EventInput): Promise<SyncRecord[]> {
  const now = new Date().toISOString()
  return saveLocal([eventRecord({ id: createId(), ...input, createdAt: now, updatedAt: now, deletedAt: null })])
}

export function saveEvent(event: CalendarEvent, input: EventInput): Promise<SyncRecord[]> {
  return saveLocal([eventRecord({ ...event, ...input, updatedAt: new Date().toISOString() })])
}

export function deleteEvent(event: CalendarEvent): Promise<SyncRecord[]> {
  return saveLocal([eventRecord(markDeleted(event, new Date().toISOString()))])
}

import type { Capture, Task } from './task'

export type SyncRecord =
  | { type: 'capture'; value: Capture }
  | { type: 'task'; value: Task }

export interface PullResponse {
  records: SyncRecord[]
  cursor: number
  more: boolean
}

export interface PushRequest {
  records: SyncRecord[]
}

/** Signals sent over the live socket. Clients pull after `changed`. */
export type LiveMessage = { type: 'changed'; cursor: number }

export type SyncStatus = 'connecting' | 'synced' | 'offline' | 'signed-out' | 'error'

export type SyncOutcome =
  | { status: 'synced'; applied: SyncRecord[] }
  | { status: 'offline' | 'signed-out' }
  | { status: 'error'; message: string }

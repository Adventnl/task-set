import type { Capture, Task } from '../src/shared/types/task'
import type { Suggestion } from './validation'

/**
 * Server rules for an incoming capture. Text is immutable and AI state is server-owned, so the
 * only accepted change to a stored capture is deletion. Returns null when nothing changes.
 */
export function mergeCapture(existing: Capture | null, incoming: Capture): Capture | null {
  if (!existing) return { ...incoming, ai: incoming.deletedAt ? null : 'queued' }
  if (existing.deletedAt || !incoming.deletedAt) return null
  return {
    ...existing,
    deletedAt: incoming.deletedAt,
    updatedAt: incoming.updatedAt > existing.updatedAt ? incoming.updatedAt : existing.updatedAt,
  }
}

/** The most recent edit wins; deletion is final; the source capture link never changes. */
export function mergeTask(existing: Task | null, incoming: Task): Task | null {
  if (!existing) return incoming
  if (existing.deletedAt || incoming.updatedAt <= existing.updatedAt) return null
  return { ...incoming, captureId: existing.captureId, createdAt: existing.createdAt }
}

/**
 * Suggestion ids are stable per capture so a retry never duplicates a draft. They carry the
 * capture's own timestamps, so any later edit from a device wins under `mergeTask`.
 */
export function suggestionTask(capture: Capture, suggestion: Suggestion, index: number): Task {
  return {
    id: `${capture.id}:s${index}`,
    captureId: capture.id,
    title: suggestion.title,
    dueAt: suggestion.dueAt,
    reminderAt: suggestion.reminderAt,
    pinned: false,
    completedAt: null,
    suggestionStatus: 'suggested',
    createdAt: capture.createdAt,
    updatedAt: capture.createdAt,
    deletedAt: null,
  }
}

export function deletedTask(task: Task, at: string): Task {
  return { ...task, deletedAt: at, updatedAt: at > task.updatedAt ? at : task.updatedAt }
}

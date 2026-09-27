import { requestTaskRetry } from '../connectors/aiConnector'
import type { SyncRecord } from '../shared/types/sync'
import type { Capture, Editor, Task, TaskInput } from '../shared/types/task'
import { markDeleted } from '../shared/utils/records'
import { expiredTasks, taskFromEditor } from '../shared/utils/taskView'
import { createId, saveLocal } from './localDataService'

// Every operation saves on this device first and returns the changed records;
// sync delivers them to the server afterwards.

const taskRecord = (value: Task): SyncRecord => ({ type: 'task', value })

export function createCapture(text: string, kind: Capture['kind']): Promise<SyncRecord[]> {
  const now = new Date().toISOString()
  const value: Capture = {
    id: createId(),
    kind,
    text,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ai: null,
  }
  return saveLocal([{ type: 'capture', value }])
}

/** Deletes captures together with the tasks made from them, in one local save. */
export function deleteCaptures(captures: Capture[], tasks: Task[]): Promise<SyncRecord[]> {
  const now = new Date().toISOString()
  const ids = new Set(captures.map((capture) => capture.id))
  return saveLocal([
    ...captures.map((capture): SyncRecord => ({ type: 'capture', value: markDeleted(capture, now) })),
    ...tasks.filter((task) => ids.has(task.captureId)).map((task) => taskRecord(markDeleted(task, now))),
  ])
}

export function saveTask(editor: Editor, input: TaskInput): Promise<SyncRecord[]> {
  return saveLocal([taskRecord(taskFromEditor(editor, input, editor.task?.id ?? createId(), new Date().toISOString()))])
}

export function deleteTask(task: Task): Promise<SyncRecord[]> {
  return saveLocal([taskRecord(markDeleted(task, new Date().toISOString()))])
}

/** Completing a task moves it to the Archive; reopening restores it to Tasks. */
export function setTaskCompleted(task: Task, completed: boolean): Promise<SyncRecord[]> {
  const now = new Date().toISOString()
  return saveLocal([taskRecord({ ...task, completedAt: completed ? now : null, updatedAt: now })])
}

/** Deletes archived tasks whose retention has ended. Saves nothing when none have. */
export async function purgeExpiredTasks(tasks: Task[], now = new Date()): Promise<SyncRecord[]> {
  const expired = expiredTasks(tasks, now)
  if (!expired.length) return []
  const at = now.toISOString()
  return saveLocal(expired.map((task) => taskRecord(markDeleted(task, at))))
}

export function setTaskPinned(task: Task, pinned: boolean): Promise<SyncRecord[]> {
  return saveLocal([taskRecord({ ...task, pinned, updatedAt: new Date().toISOString() })])
}

export function reviewSuggestion(task: Task, action: 'accept' | 'dismiss'): Promise<SyncRecord[]> {
  const suggestionStatus = action === 'accept' ? null : 'dismissed'
  return saveLocal([taskRecord({ ...task, suggestionStatus, updatedAt: new Date().toISOString() })])
}

export function retryTaskSuggestions(capture: Capture): Promise<void> {
  return requestTaskRetry(capture.id)
}

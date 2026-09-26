import { requestTaskRetry } from '../connectors/aiConnector'
import type { SyncRecord } from '../shared/types/sync'
import type { Capture, Editor, Task, TaskInput } from '../shared/types/task'
import { taskFromEditor } from '../shared/utils/taskView'
import { createId, saveLocal } from './localDataService'

// Every operation saves on this device first and returns the changed records;
// sync delivers them to the server afterwards.

async function save(records: SyncRecord[]): Promise<SyncRecord[]> {
  await saveLocal(records)
  return records
}

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
  return save([{ type: 'capture', value }])
}

/** Deletes captures together with the tasks made from them, in one local save. */
export function deleteCaptures(captures: Capture[], tasks: Task[]): Promise<SyncRecord[]> {
  const now = new Date().toISOString()
  const ids = new Set(captures.map((capture) => capture.id))
  return save([
    ...captures.map((capture): SyncRecord => ({ type: 'capture', value: { ...capture, deletedAt: now, updatedAt: now } })),
    ...tasks.filter((task) => ids.has(task.captureId)).map((task) => taskRecord({ ...task, deletedAt: now, updatedAt: now })),
  ])
}

export function saveTask(editor: Editor, input: TaskInput): Promise<SyncRecord[]> {
  return save([taskRecord(taskFromEditor(editor, input, editor.task?.id ?? createId(), new Date().toISOString()))])
}

export function deleteTask(task: Task): Promise<SyncRecord[]> {
  const now = new Date().toISOString()
  return save([taskRecord({ ...task, deletedAt: now, updatedAt: now })])
}

export function setTaskCompleted(task: Task, completed: boolean): Promise<SyncRecord[]> {
  const now = new Date().toISOString()
  return save([taskRecord({ ...task, completedAt: completed ? now : null, updatedAt: now })])
}

export function setTaskPinned(task: Task, pinned: boolean): Promise<SyncRecord[]> {
  return save([taskRecord({ ...task, pinned, updatedAt: new Date().toISOString() })])
}

export function reviewSuggestion(task: Task, action: 'accept' | 'dismiss'): Promise<SyncRecord[]> {
  const suggestionStatus = action === 'accept' ? null : 'dismissed'
  return save([taskRecord({ ...task, suggestionStatus, updatedAt: new Date().toISOString() })])
}

export function retryTaskSuggestions(capture: Capture): Promise<void> {
  return requestTaskRetry(capture.id)
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { loadData } from '../../services/localDataService'
import * as workspace from '../../services/workspaceService'
import type { SyncRecord } from '../types/sync'
import type { Capture, Editor, Task, TaskInput } from '../types/task'
import { mergeRecords } from '../utils/records'
import { useSync } from './useSync'

const EMPTY = { captures: [] as Capture[], tasks: [] as Task[] }

/** Owns the captures and tasks on screen, the local-first actions on them, and sync. */
export function useTaskSet() {
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const busyIds = useRef(new Set<string>())

  const merge = useCallback((records: SyncRecord[]) => setData((current) => mergeRecords(current, records)), [])
  // Sync starts after the local copy is on screen, so pulled changes always apply on top of it.
  const sync = useSync({ enabled: !loading, onApplied: merge, onReset: () => setData(EMPTY) })
  const requestSync = sync.sync

  useEffect(() => {
    let active = true
    loadData()
      .then((loaded) => {
        if (active) setData(loaded)
      })
      .catch(() => {
        if (active) setNotice('This browser is blocking local storage, so nothing can be saved. Check its privacy settings, then reload.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  /** Saves on this device, shows the change, then syncs. Returns false when the local save failed. */
  const commit = useCallback(
    async (key: string, operation: () => Promise<SyncRecord[]>, done: string, failure: string): Promise<boolean> => {
      if (busyIds.current.has(key)) return false
      busyIds.current.add(key)
      try {
        merge(await operation())
        setAnnouncement(done)
        void requestSync()
        return true
      } catch {
        setNotice(failure)
        return false
      } finally {
        busyIds.current.delete(key)
      }
    },
    [merge, requestSync],
  )

  const sendCapture = (text: string, kind: Capture['kind']) =>
    commit(`send:${text}`, () => workspace.createCapture(text, kind), 'Saved', 'Could not save that on this device. Your words are still in the box; try again.')

  const deleteCapture = (capture: Capture) =>
    commit(
      capture.id,
      () => workspace.deleteCapture(capture, data.tasks.filter((task) => task.captureId === capture.id)),
      'Message deleted',
      'Could not delete that message. Try again.',
    )

  const toggleTask = (task: Task) =>
    commit(task.id, () => workspace.setTaskCompleted(task, !task.completedAt), task.completedAt ? 'Task reopened' : 'Task done', 'Could not update that task. Try again.')

  const reviewSuggestion = (task: Task, action: 'accept' | 'dismiss') =>
    commit(task.id, () => workspace.reviewSuggestion(task, action), action === 'accept' ? 'Task created' : 'Suggestion dismissed', 'Could not update that suggestion. Try again.')

  /** Throws on failure so the editor can keep its fields and explain. */
  async function saveTask(editor: Editor, input: TaskInput) {
    merge(await workspace.saveTask(editor, input))
    setAnnouncement(editor.task ? 'Task saved' : 'Task created')
    void requestSync()
  }

  const deleteTask = (task: Task) => commit(task.id, () => workspace.deleteTask(task), 'Task deleted; the message is kept', 'Could not delete that task. Try again.')

  async function retrySuggestions(capture: Capture) {
    try {
      await workspace.retryTaskSuggestions(capture)
      void requestSync()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not reach Task Set. Try again when you are online.')
    }
  }

  return {
    captures: data.captures,
    tasks: data.tasks,
    loading,
    notice,
    setNotice,
    announcement,
    sync,
    sendCapture,
    deleteCapture,
    toggleTask,
    reviewSuggestion,
    saveTask,
    deleteTask,
    retrySuggestions,
  }
}

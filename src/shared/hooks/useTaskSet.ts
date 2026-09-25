import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createId,
  deleteTask,
  loadData,
  saveCapture,
  saveTranscriptAndDismissDrafts,
  saveTask,
} from '../../services/localDataService'
import { processCapture, type ProcessingPhase } from '../../services/aiService'
import type { Capture, Task, View, Editor, TaskInput } from '../types/task'
import {
  selectCaptureData,
  taskFromEditor,
  tasksForView,
} from '../utils/taskView'
import { useVoiceRecorder } from './useVoiceRecorder'

export function useTaskSet() {
  const [view, setView] = useState<View>('feed')
  const [captures, setCaptures] = useState<Capture[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [composer, setComposer] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [editingTranscriptId, setEditingTranscriptId] = useState<string | null>(
    null,
  )
  const [transcriptDraft, setTranscriptDraft] = useState('')
  const [processing, setProcessing] = useState<Record<string, ProcessingPhase>>(
    {},
  )
  const [localSaveFailures, setLocalSaveFailures] = useState<Set<string>>(
    new Set(),
  )
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const savingRef = useRef(false)
  const pendingTaskIdsRef = useRef(new Set<string>())
  const pendingAiIdsRef = useRef(new Set<string>())
  const voice = useVoiceRecorder(async (audio) => {
    const capture: Capture = {
      id: createId(),
      kind: 'voice',
      text: '',
      audio,
      mimeType: audio.type,
      aiStatus: 'saved',
      createdAt: new Date().toISOString(),
    }
    setCaptures((current) => [...current, capture])
    setView('feed')
    setSearch('')
    setSearchOpen(false)
    requestAnimationFrame(() => {
      if (scrollRef.current)
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    })
    try {
      await saveCapture(capture)
      setAnnouncement('Recording saved in this browser')
    } catch {
      setLocalSaveFailures((current) => new Set(current).add(capture.id))
      throw new Error('Could not save recording')
    }
  })

  useEffect(() => {
    let active = true
    loadData()
      .then((data) => {
        if (!active) return
        setCaptures(data.captures)
        setTasks(data.tasks)
        setLoading(false)
        requestAnimationFrame(() => {
          if (scrollRef.current)
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        })
      })
      .catch(() => {
        if (!active) return
        setError(
          'Local storage is unavailable. Check your browser settings, then reload.',
        )
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (editor) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setView('feed')
        setSearchOpen(true)
        requestAnimationFrame(() => searchRef.current?.focus())
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        setView('feed')
        composerRef.current?.focus()
      }
      if (event.key === 'Escape' && !editor) {
        setSearchOpen(false)
        setSearch('')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editor])

  async function sendCapture() {
    const text = composer.trim()
    if (!text || loading || savingRef.current) return
    savingRef.current = true
    const capture: Capture = {
      id: createId(),
      kind: 'text',
      text,
      createdAt: new Date().toISOString(),
    }
    setCaptures((current) => [...current, capture])
    setComposer('')
    setView('feed')
    setSearch('')
    setSearchOpen(false)
    setError('')
    requestAnimationFrame(() => {
      if (scrollRef.current)
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    })
    try {
      await saveCapture(capture)
      setAnnouncement('Capture saved in this browser')
    } catch {
      setCaptures((current) => current.filter((item) => item.id !== capture.id))
      setComposer((current) => (current ? `${text}\n${current}` : text))
      setError(
        'Could not save this capture. Your text is back in the composer. Try again.',
      )
    } finally {
      savingRef.current = false
      composerRef.current?.focus()
    }
  }

  async function retryLocalSave(capture: Capture) {
    try {
      await saveCapture(capture)
      setLocalSaveFailures((current) => {
        const next = new Set(current)
        next.delete(capture.id)
        return next
      })
      setAnnouncement('Recording saved in this browser')
    } catch {
      setError(
        'Could not save the recording. It remains available in this open tab.',
      )
    }
  }

  async function processAi(capture: Capture) {
    if (
      pendingAiIdsRef.current.has(capture.id) ||
      localSaveFailures.has(capture.id)
    )
      return
    pendingAiIdsRef.current.add(capture.id)
    setProcessing((current) => ({
      ...current,
      [capture.id]:
        capture.kind === 'voice' && !capture.text
          ? 'transcribing'
          : 'extracting',
    }))
    try {
      const result = await processCapture(capture, (phase) =>
        setProcessing((current) => ({ ...current, [capture.id]: phase })),
      )
      setCaptures((current) =>
        current.map((item) => (item.id === capture.id ? result.capture : item)),
      )
      setTasks((current) => {
        const next = new Map(current.map((task) => [task.id, task]))
        for (const task of result.suggestions) next.set(task.id, task)
        return [...next.values()]
      })
      setAnnouncement(
        result.suggestions.length
          ? `${result.suggestions.length} task suggestion${result.suggestions.length === 1 ? '' : 's'} ready`
          : 'No task suggestions found',
      )
    } catch (failure) {
      const message =
        failure instanceof Error
          ? failure.message
          : 'AI is unavailable. Try again later.'
      try {
        const latest =
          (await loadData()).captures.find((item) => item.id === capture.id) ??
          capture
        const failed: Capture = { ...latest, aiStatus: 'needs-retry' }
        await saveCapture(failed)
        setCaptures((current) =>
          current.map((item) => (item.id === capture.id ? failed : item)),
        )
      } catch {
        setError(`${message} The retry status could not be saved locally; your capture remains visible in this tab.`)
        return
      }
      setError(message)
    } finally {
      pendingAiIdsRef.current.delete(capture.id)
      setProcessing((current) => {
        const next = { ...current }
        delete next[capture.id]
        return next
      })
    }
  }

  async function reviewSuggestion(task: Task, action: 'accept' | 'dismiss') {
    if (pendingTaskIdsRef.current.has(task.id)) return
    pendingTaskIdsRef.current.add(task.id)
    const next: Task = {
      ...task,
      suggestionStatus: action === 'accept' ? null : 'dismissed',
      updatedAt: new Date().toISOString(),
    }
    try {
      await saveTask(next)
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? next : item)),
      )
      setAnnouncement(
        action === 'accept' ? 'Task added' : 'Suggestion dismissed',
      )
    } catch {
      setError('Could not update the suggestion. Please try again.')
    } finally {
      pendingTaskIdsRef.current.delete(task.id)
    }
  }

  async function saveEditedTask(input: TaskInput) {
    if (!editor) return
    const now = new Date().toISOString()
    const task = taskFromEditor(
      editor,
      input,
      editor.task?.id ?? createId(),
      now,
    )
    await saveTask(task)
    setTasks((current) =>
      editor.task
        ? current.map((item) => (item.id === task.id ? task : item))
        : [...current, task],
    )
    setEditor(null)
    setAnnouncement(editor.task ? 'Task updated' : 'Task added')
  }

  async function removeEditedTask() {
    if (!editor?.task) return
    await deleteTask(editor.task.id)
    setTasks((current) => current.filter((task) => task.id !== editor.task?.id))
    setEditor(null)
    setAnnouncement('Task removed; capture kept')
  }

  async function toggleTask(task: Task) {
    if (pendingTaskIdsRef.current.has(task.id)) return
    pendingTaskIdsRef.current.add(task.id)
    const next = {
      ...task,
      completedAt: task.completedAt ? null : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setTasks((current) =>
      current.map((item) => (item.id === task.id ? next : item)),
    )
    try {
      await saveTask(next)
      setAnnouncement(next.completedAt ? 'Task completed' : 'Task reopened')
    } catch {
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? task : item)),
      )
      setError('Could not update the task. Please try again.')
    } finally {
      pendingTaskIdsRef.current.delete(task.id)
    }
  }

  async function saveTranscript(capture: Capture) {
    const next: Capture = {
      ...capture,
      text: transcriptDraft.trim(),
      aiStatus: 'saved',
    }
    try {
      const drafts =
        next.text !== capture.text
          ? tasks.filter(
              (task) =>
                task.captureId === capture.id &&
                task.suggestionStatus === 'suggested',
            )
          : []
      await saveTranscriptAndDismissDrafts(next, drafts)
      if (drafts.length) {
        setTasks((current) =>
          current.map((task) =>
            task.captureId === capture.id &&
            task.suggestionStatus === 'suggested'
              ? { ...task, suggestionStatus: 'dismissed' }
              : task,
          ),
        )
      }
      setCaptures((current) =>
        current.map((item) => (item.id === capture.id ? next : item)),
      )
      setEditingTranscriptId(null)
      setTranscriptDraft('')
    } catch {
      setError('Could not save the transcript. Please try again.')
    }
  }

  const { visibleCaptures, tasksByCapture } = useMemo(
    () => selectCaptureData(captures, tasks, search),
    [captures, tasks, search],
  )
  const viewTasks = view === 'feed' ? [] : tasksForView(tasks, view)
  const counts = {
    today: tasksForView(tasks, 'today').length,
    inbox: tasksForView(tasks, 'inbox').length,
    upcoming: tasksForView(tasks, 'upcoming').length,
  }

  return {
    view,
    setView,
    captures,
    tasks,
    loading,
    error,
    setError,
    announcement,
    composer,
    setComposer,
    searchOpen,
    setSearchOpen,
    search,
    setSearch,
    editor,
    setEditor,
    online,
    editingTranscriptId,
    setEditingTranscriptId,
    transcriptDraft,
    setTranscriptDraft,
    processing,
    localSaveFailures,
    composerRef,
    searchRef,
    scrollRef,
    voice,
    sendCapture,
    retryLocalSave,
    processAi,
    reviewSuggestion,
    saveEditedTask,
    removeEditedTask,
    toggleTask,
    saveTranscript,
    visibleCaptures,
    tasksByCapture,
    viewTasks,
    counts,
  }
}

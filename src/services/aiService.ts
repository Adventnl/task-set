import { extractSuggestions, transcribeAudio } from '../connectors/aiConnector'
import { loadData, saveCapture, saveTask, type Capture, type Task } from '../data'

export type ProcessingPhase = 'transcribing' | 'extracting'

function textFingerprint(text: string): string {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export async function processCapture(capture: Capture, onPhase: (phase: ProcessingPhase) => void): Promise<{ capture: Capture; suggestions: Task[] }> {
  let current = capture
  if (current.kind === 'voice' && !current.text) {
    if (!current.audio) throw new Error('The recording is missing from this browser.')
    onPhase('transcribing')
    const text = await transcribeAudio(current.audio)
    current = { ...current, text, aiStatus: 'saved' }
    await saveCapture(current)
  }
  if (!current.text.trim()) throw new Error('Add a transcript before looking for tasks.')
  onPhase('extracting')
  const suggestions = await extractSuggestions(current.text)
  const existing = new Map((await loadData()).tasks.map((task) => [task.id, task]))
  const now = new Date().toISOString()
  const saved: Task[] = []
  for (const [index, suggestion] of suggestions.entries()) {
    const id = `${current.id}:suggestion:${textFingerprint(current.text)}:${index}`
    const prior = existing.get(id)
    if (prior) { saved.push(prior); continue }
    const task: Task = {
      id, captureId: current.id, title: suggestion.title,
      dueAt: suggestion.dueAt, reminderAt: suggestion.reminderAt,
      pinned: false, completedAt: null, createdAt: now, updatedAt: now,
      suggestionStatus: 'suggested',
    }
    await saveTask(task)
    saved.push(task)
  }
  current = { ...current, aiStatus: 'ready' }
  await saveCapture(current)
  return { capture: current, suggestions: saved }
}

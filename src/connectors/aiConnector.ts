export interface TaskSuggestion {
  title: string
  dueAt: string | null
  reminderAt: string | null
}

async function responseJson(response: Response): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
      ? body.error : 'AI is unavailable. Try again later.'
    throw new Error(message)
  }
  return body
}

export async function transcribeAudio(audio: Blob): Promise<string> {
  const response = await fetch('/api/ai/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': audio.type },
    body: audio,
    credentials: 'same-origin',
  })
  const result = await responseJson(response)
  if (!result || typeof result !== 'object' || !('text' in result) || typeof result.text !== 'string' || !result.text.trim()) throw new Error('The transcription response was invalid.')
  return result.text.trim()
}

export async function extractSuggestions(text: string): Promise<TaskSuggestion[]> {
  const response = await fetch('/api/ai/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, now: new Date().toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    credentials: 'same-origin',
  })
  const result = await responseJson(response)
  if (!result || typeof result !== 'object' || !('suggestions' in result) || !Array.isArray(result.suggestions)) throw new Error('The suggestion response was invalid.')
  return result.suggestions.map((item: unknown) => {
    if (!item || typeof item !== 'object' || !('title' in item) || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 200) throw new Error('The suggestion response was invalid.')
    const dueAt = 'dueAt' in item && typeof item.dueAt === 'string' ? item.dueAt : null
    const reminderAt = 'reminderAt' in item && typeof item.reminderAt === 'string' ? item.reminderAt : null
    if ([dueAt, reminderAt].some((value) => value && !Number.isFinite(Date.parse(value)))) throw new Error('The suggestion response contained an invalid date.')
    return { title: item.title.trim(), dueAt, reminderAt }
  })
}

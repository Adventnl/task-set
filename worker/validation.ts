function validDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) return null
  const date = new Date(value)
  return Number.isFinite(date.valueOf()) ? date.toISOString() : null
}

export function parseSuggestions(raw: unknown, sourceText: string): { title: string; dueAt: string | null; reminderAt: string | null }[] {
  const response = raw && typeof raw === 'object' && 'response' in raw ? raw.response : null
  const value: unknown = typeof response === 'string' ? JSON.parse(response) : response
  if (!value || typeof value !== 'object' || !('suggestions' in value) || !Array.isArray(value.suggestions)) throw new Error('Invalid AI response')
  return value.suggestions.slice(0, 5).map((item: unknown) => {
    if (!item || typeof item !== 'object' || !('title' in item) || typeof item.title !== 'string') throw new Error('Invalid suggestion')
    const title = item.title.trim()
    if (!title || title.length > 200) throw new Error('Invalid suggestion title')
    const source = sourceText.toLocaleLowerCase()
    const evidence = 'evidence' in item && typeof item.evidence === 'string' ? item.evidence.trim() : ''
    if (!evidence || !source.includes(evidence.toLocaleLowerCase())) throw new Error('Suggestion lacks source evidence')
    const dueEvidence = 'dueEvidence' in item && typeof item.dueEvidence === 'string' ? item.dueEvidence.trim() : ''
    const reminderEvidence = 'reminderEvidence' in item && typeof item.reminderEvidence === 'string' ? item.reminderEvidence.trim() : ''
    return {
      title,
      dueAt: dueEvidence && source.includes(dueEvidence.toLocaleLowerCase()) && 'dueAt' in item ? validDate(item.dueAt) : null,
      reminderAt: reminderEvidence && source.includes(reminderEvidence.toLocaleLowerCase()) && 'reminderAt' in item ? validDate(item.reminderAt) : null,
    }
  })
}

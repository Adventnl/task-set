import type { Capture } from '../types/task'

/** `create` puts tasks straight into Tasks; `suggest` offers them for review under the note. */
export type GenerationMode = 'create' | 'suggest'

/** An explicit command in a note creates tasks. */
export function requestsTaskGeneration(text: string): boolean {
  return text.split(/[.!?\n]/).some((sentence) =>
    /\bgenerate\s+(?:a\s+)?tasks?\b/i.test(sentence)
    && !/\b(?:don['’]t|do\s+not|never|not\s+to)\s+(?:automatically\s+)?generate\s+(?:a\s+)?tasks?\b/i.test(sentence),
  )
}

/**
 * What the server looks for in a new note without being asked: a “generate task” command creates
 * tasks, a voice note gets suggestions to review, and a typed note stays a note until its menu asks.
 */
export function automaticGeneration(capture: Pick<Capture, 'kind' | 'text'>): GenerationMode | null {
  if (requestsTaskGeneration(capture.text)) return 'create'
  return capture.kind === 'voice' ? 'suggest' : null
}

import { MAX_TITLE_LENGTH } from '../src/shared/utils/records'
import { localToUtc } from './time'

export interface Suggestion {
  title: string
  dueAt: string | null
  reminderAt: string | null
}

const MAX_SUGGESTIONS = 5
/** A day named without a time: be reminded in the morning; a deadline falls due late afternoon. */
const DEFAULT_TIMES = { dueAt: '17:00', reminderAt: '09:00' } as const
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
/** Only these words make a time a deadline; any other stated time is when to do it. */
const DEADLINE_WORDS = /\b(by|before|due|deadline|until|no later than)\b/i
/** Times before the message was written, or absurdly far ahead, are model errors. */
const EARLIEST_MS = 12 * 60 * 60 * 1000
const LATEST_MS = 3 * 366 * 24 * 60 * 60 * 1000

/** Lowercases and strips punctuation so quoted evidence survives small transcript differences. */
function normalize(text: string): string {
  return text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function field(item: object, key: string): unknown {
  return key in item ? (item as Record<string, unknown>)[key] : undefined
}

function quoted(item: object, key: string, source: string): boolean {
  const value = field(item, key)
  return typeof value === 'string' && !!normalize(value) && source.includes(normalize(value))
}

interface Context {
  source: string
  timeZone: string
  writtenAt: number
}

function localTime(item: object, key: keyof typeof DEFAULT_TIMES, context: Context): string | null {
  const value = field(item, key)
  if (typeof value !== 'string' || !quoted(item, `${key.replace('At', '')}Evidence`, context.source)) return null
  const time = localToUtc(DATE_ONLY.test(value) ? `${value}T${DEFAULT_TIMES[key]}` : value, context.timeZone)
  if (!time) return null
  const offset = Date.parse(time) - context.writtenAt
  return offset >= -EARLIEST_MS && offset <= LATEST_MS ? time : null
}

/** Enforces the product rule: a plain time is a reminder; only deadline words set a due date. */
function schedule(item: object, context: Context): Pick<Suggestion, 'dueAt' | 'reminderAt'> {
  let dueAt = localTime(item, 'dueAt', context)
  let reminderAt = localTime(item, 'reminderAt', context)
  const dueEvidence = field(item, 'dueEvidence')
  if (dueAt && !(typeof dueEvidence === 'string' && DEADLINE_WORDS.test(dueEvidence))) {
    reminderAt ??= dueAt
    dueAt = null
  }
  if (dueAt && reminderAt && normalize(String(dueEvidence)) === normalize(String(field(item, 'reminderEvidence')))) {
    reminderAt = null
  }
  return { dueAt, reminderAt }
}

/**
 * Validates model output against the source text. Suggestions that cannot be traced to a quote
 * in the capture are dropped; a malformed response as a whole is an error.
 */
export function parseSuggestions(raw: unknown, sourceText: string, timeZone: string, writtenAt: string): Suggestion[] {
  const response = raw && typeof raw === 'object' && 'response' in raw ? raw.response : null
  let value: unknown = response
  if (typeof response === 'string') {
    try {
      value = JSON.parse(response)
    } catch {
      throw new Error('AI response was not JSON')
    }
  }
  if (!value || typeof value !== 'object' || !('suggestions' in value) || !Array.isArray(value.suggestions)) {
    throw new Error('AI response had no suggestions list')
  }
  const source = normalize(sourceText)
  const context: Context = { source, timeZone, writtenAt: Date.parse(writtenAt) }
  const seen = new Set<string>()
  const suggestions: Suggestion[] = []
  for (const item of value.suggestions as unknown[]) {
    if (!item || typeof item !== 'object') continue
    const rawTitle = field(item, 'title')
    const title = typeof rawTitle === 'string' ? rawTitle.trim().replace(/[.!]+$/, '') : ''
    if (!title || title.length > MAX_TITLE_LENGTH || seen.has(normalize(title))) continue
    if (!quoted(item, 'evidence', source)) continue
    seen.add(normalize(title))
    suggestions.push({ title, ...schedule(item, context) })
    if (suggestions.length === MAX_SUGGESTIONS) break
  }
  return suggestions
}

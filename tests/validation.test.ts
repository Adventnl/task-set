import { describe, expect, it } from 'vitest'
import { parseSuggestions } from '../worker/validation'

describe('AI output validation', () => {
  it('keeps due and reminder times separate and drops invalid dates', () => {
    expect(parseSuggestions({ response: { suggestions: [{ title: '  Email Sam ', evidence: 'Email Sam', dueAt: null, dueEvidence: '', reminderAt: '2026-09-25T21:00:00Z', reminderEvidence: 'tomorrow' }, { title: 'Buy milk', evidence: 'Buy milk', dueAt: 'tomorrow', dueEvidence: 'tomorrow', reminderAt: null, reminderEvidence: '' }] } }, 'Email Sam tomorrow. Buy milk tomorrow.')).toEqual([
      { title: 'Email Sam', dueAt: null, reminderAt: '2026-09-25T21:00:00.000Z' },
      { title: 'Buy milk', dueAt: null, reminderAt: null },
    ])
  })

  it('rejects malformed actions', () => {
    expect(() => parseSuggestions({ response: { suggestions: [{ title: '' }] } }, 'Email Sam')).toThrow()
    expect(() => parseSuggestions({ response: 'not json' }, 'Email Sam')).toThrow()
    expect(() => parseSuggestions({ response: { suggestions: [{ title: 'Invented', evidence: 'not present' }] } }, 'Email Sam')).toThrow()
  })
})

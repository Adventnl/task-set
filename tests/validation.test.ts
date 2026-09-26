import { describe, expect, it } from 'vitest'
import { localToUtc, describeLocalTime } from '../worker/time'
import { parseSuggestions } from '../worker/validation'

const item = (overrides: Record<string, unknown>) => ({
  title: 'Email Sam',
  evidence: 'Email Sam',
  dueAt: null,
  dueEvidence: '',
  reminderAt: null,
  reminderEvidence: '',
  ...overrides,
})

describe('local time conversion', () => {
  it('converts wall-clock time in a zone to UTC, including DST and half-hour offsets', () => {
    expect(localToUtc('2026-09-27T09:00', 'America/New_York')).toBe('2026-09-27T13:00:00.000Z')
    expect(localToUtc('2026-12-01T09:00', 'America/New_York')).toBe('2026-12-01T14:00:00.000Z')
    expect(localToUtc('2026-12-01T09:00', 'Europe/London')).toBe('2026-12-01T09:00:00.000Z')
    expect(localToUtc('2026-09-27T09:00', 'Asia/Kolkata')).toBe('2026-09-27T03:30:00.000Z')
  })

  it('rejects impossible or zoned values', () => {
    expect(localToUtc('2026-02-30T09:00', 'UTC')).toBeNull()
    expect(localToUtc('2026-09-27T25:00', 'UTC')).toBeNull()
    expect(localToUtc('2026-09-27T09:00Z', 'UTC')).toBeNull()
    expect(localToUtc('tomorrow', 'UTC')).toBeNull()
  })

  it('describes the author’s local time for the model', () => {
    expect(describeLocalTime('2026-09-26T03:14:00.000Z', 'America/New_York')).toBe('Friday 2026-09-25 23:14')
  })
})

describe('AI output validation', () => {
  const zone = 'America/New_York'
  const written = '2026-09-26T03:00:00.000Z'

  it('keeps due and reminder separate and converts quoted local times', () => {
    const raw = {
      response: {
        suggestions: [
          item({ title: ' Email Sam. ', reminderAt: '2026-09-27T09:00', reminderEvidence: 'tomorrow morning' }),
          item({ title: 'Pay rent', evidence: 'pay rent', dueAt: '2026-10-02T09:00', dueEvidence: 'by Friday' }),
        ],
      },
    }
    expect(parseSuggestions(raw, 'Email Sam tomorrow morning, and pay rent by Friday', zone, written)).toEqual([
      { title: 'Email Sam', dueAt: null, reminderAt: '2026-09-27T13:00:00.000Z' },
      { title: 'Pay rent', dueAt: '2026-10-02T13:00:00.000Z', reminderAt: null },
    ])
  })

  it('drops times whose phrase is not in the message', () => {
    const raw = { response: { suggestions: [item({ dueAt: '2026-09-27T09:00', dueEvidence: 'by Monday' })] } }
    expect(parseSuggestions(raw, 'Email Sam', zone, written)[0].dueAt).toBeNull()
  })

  it('tolerates punctuation differences in evidence from speech', () => {
    const raw = { response: JSON.stringify({ suggestions: [item({ evidence: 'I need to email Sam' })] }) }
    expect(parseSuggestions(raw, 'I need to, uh, email Sam', zone, written)).toHaveLength(0)
    expect(parseSuggestions(raw, 'I need to email Sam.', zone, written)).toHaveLength(1)
  })

  it('drops invented, empty, and duplicate suggestions but keeps the rest', () => {
    const raw = {
      response: {
        suggestions: [item({}), item({ title: 'Invented', evidence: 'not present' }), item({ title: '' }), item({ title: 'email sam' })],
      },
    }
    expect(parseSuggestions(raw, 'Email Sam', zone, written).map((suggestion) => suggestion.title)).toEqual(['Email Sam'])
  })

  it('treats a plain time as a reminder and fills a date-only deadline at 17:00', () => {
    const raw = {
      response: {
        suggestions: [
          item({ title: 'Pick up package', evidence: 'pick up the package', dueAt: '2026-10-01T14:00', dueEvidence: 'thursday afternoon' }),
          item({ title: 'Pay rent', evidence: 'pay rent', dueAt: '2026-10-02', dueEvidence: 'by Friday', reminderAt: '2026-10-02', reminderEvidence: 'by Friday' }),
        ],
      },
    }
    expect(parseSuggestions(raw, 'thursday afternoon pick up the package, pay rent by Friday', zone, written)).toEqual([
      { title: 'Pick up package', dueAt: null, reminderAt: '2026-10-01T18:00:00.000Z' },
      { title: 'Pay rent', dueAt: '2026-10-02T21:00:00.000Z', reminderAt: null },
    ])
  })

  it('drops times in the past or years ahead, which are model errors', () => {
    const raw = {
      response: {
        suggestions: [
          item({ reminderAt: '2024-09-25T20:00', reminderEvidence: 'tonight' }),
          item({ title: 'Plan trip', evidence: 'plan trip', reminderAt: '2031-01-01T09:00', reminderEvidence: 'tonight' }),
        ],
      },
    }
    expect(parseSuggestions(raw, 'Email Sam and plan trip tonight', zone, written).map((suggestion) => suggestion.reminderAt)).toEqual([null, null])
  })

  it('rejects a malformed response', () => {
    expect(() => parseSuggestions({ response: 'not json' }, 'Email Sam', zone, written)).toThrow()
    expect(() => parseSuggestions({ response: { tasks: [] } }, 'Email Sam', zone, written)).toThrow()
    expect(() => parseSuggestions(null, 'Email Sam', zone, written)).toThrow()
  })
})

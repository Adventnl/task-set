import { describe, expect, it } from 'vitest'
import { automaticGeneration, requestsTaskGeneration } from '../src/shared/utils/capture'

describe('explicit task generation', () => {
  it.each(['Generate task: call Sam', 'please generate a task to call Sam', 'GENERATE TASKS: water plants and call Sam', 'A note. Generate task: call Sam'])('accepts an explicit command: %s', (text) => {
    expect(requestsTaskGeneration(text)).toBe(true)
  })
  it.each(['Call Sam tomorrow', 'I need to pay rent', 'Task generation is useful', 'Regenerate task lists', 'Do not generate task: call Sam', 'Don’t generate tasks for this note', 'Never generate tasks', 'Don’t automatically generate tasks from this note'])('keeps ordinary notes and negations: %s', (text) => {
    expect(requestsTaskGeneration(text)).toBe(false)
  })
})

describe('automatic task generation', () => {
  it('creates tasks for an explicit command, typed or spoken', () => {
    expect(automaticGeneration({ kind: 'text', text: 'Generate task: call Sam' })).toBe('create')
    expect(automaticGeneration({ kind: 'voice', text: 'Generate tasks: call Sam' })).toBe('create')
  })
  it('suggests tasks for a voice note', () => {
    expect(automaticGeneration({ kind: 'voice', text: 'Call Sam tomorrow' })).toBe('suggest')
    expect(automaticGeneration({ kind: 'voice', text: 'Do not generate task: call Sam' })).toBe('suggest')
  })
  it('leaves a typed note alone until its menu asks', () => {
    expect(automaticGeneration({ kind: 'text', text: 'Call Sam tomorrow' })).toBeNull()
  })
})

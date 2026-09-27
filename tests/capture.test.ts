import { describe, expect, it } from 'vitest'
import { requestsTaskGeneration } from '../src/shared/utils/capture'

describe('explicit task generation', () => {
  it.each(['Generate task: call Sam', 'please generate a task to call Sam', 'GENERATE TASKS: water plants and call Sam', 'A note. Generate task: call Sam'])('accepts an explicit command: %s', (text) => {
    expect(requestsTaskGeneration(text)).toBe(true)
  })
  it.each(['Call Sam tomorrow', 'I need to pay rent', 'Task generation is useful', 'Regenerate task lists', 'Do not generate task: call Sam', 'Don’t generate tasks for this note', 'Never generate tasks', 'Don’t automatically generate tasks from this note'])('keeps ordinary notes and negations: %s', (text) => {
    expect(requestsTaskGeneration(text)).toBe(false)
  })
})

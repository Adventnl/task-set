import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadData, saveCapture, saveTask } from '../src/services/localDataService'
import type { Capture } from '../src/shared/types/task'
import { processCapture } from '../src/services/aiService'
import { extractSuggestions, transcribeAudio } from '../src/connectors/aiConnector'

vi.mock('../src/connectors/aiConnector', () => ({ transcribeAudio: vi.fn(), extractSuggestions: vi.fn() }))

describe('AI capture processing', () => {
  beforeEach(() => vi.resetAllMocks())

  it('saves a transcript before extraction and keeps audio when extraction fails', async () => {
    const capture: Capture = { id: 'voice-a', kind: 'voice', text: '', createdAt: '2026-09-25T00:00:00.000Z', audio: new Blob(['audio'], { type: 'audio/webm' }) }
    await saveCapture(capture)
    vi.mocked(transcribeAudio).mockResolvedValue('Change the Cloudflare email')
    vi.mocked(extractSuggestions).mockRejectedValue(new Error('offline'))

    await expect(processCapture(capture, () => {})).rejects.toThrow('offline')
    const saved = (await loadData()).captures.find((item) => item.id === capture.id)
    expect(saved?.text).toBe('Change the Cloudflare email')
    expect(saved?.audio?.size).toBeGreaterThan(0)
  })

  it('does not duplicate or revive a dismissed suggestion on retry', async () => {
    const capture: Capture = { id: 'text-b', kind: 'text', text: 'Email Sam tomorrow', createdAt: '2026-09-25T00:00:00.000Z' }
    await saveCapture(capture)
    vi.mocked(extractSuggestions).mockResolvedValue([{ title: 'Email Sam', dueAt: null, reminderAt: '2026-09-25T21:00:00.000Z' }])

    const first = await processCapture(capture, () => {})
    expect(first.suggestions).toHaveLength(1)
    expect(first.suggestions[0].dueAt).toBeNull()
    await saveTask({ ...first.suggestions[0], suggestionStatus: 'dismissed' })
    const second = await processCapture(capture, () => {})

    expect(second.suggestions).toHaveLength(1)
    expect(second.suggestions[0].suggestionStatus).toBe('dismissed')
    expect((await loadData()).tasks.filter((task) => task.captureId === capture.id)).toHaveLength(1)
  })
})

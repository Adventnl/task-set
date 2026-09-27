import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Capture } from '../src/shared/types/task'
import { extractSuggestions } from '../worker/extraction'

const capture = {
  id: 'capture-1',
  text: 'Generate task: Email Sam',
  timeZone: 'UTC',
  createdAt: '2026-09-26T03:00:00.000Z',
} as Capture

const answer = {
  suggestions: [{ title: 'Email Sam', evidence: 'Email Sam', dueAt: null, dueEvidence: '', reminderAt: null, reminderEvidence: '' }],
}
const expected = [{ title: 'Email Sam', dueAt: null, reminderAt: null }]

function env(run: () => Promise<unknown>, secrets: { OPENROUTER_API_KEY?: string } = { OPENROUTER_API_KEY: 'test-key' }) {
  return { AI: { run: vi.fn(run) }, ...secrets } as unknown as { AI: Env['AI']; OPENROUTER_API_KEY?: string }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('task extraction', () => {
  it('does not call either model for an ordinary note or a negated command', async () => {
    const run = vi.fn(async () => ({ response: answer }))
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    for (const text of ['Email Sam', 'I should email Sam tomorrow', 'Do not generate task: Email Sam']) {
      expect(await extractSuggestions(env(run), { ...capture, text })).toEqual([])
    }
    expect(run).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('uses Workers AI and does not call OpenRouter when it answers', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(extractSuggestions(env(async () => ({ response: answer })), capture)).resolves.toEqual(expected)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('falls back to OpenRouter when Workers AI fails, such as after the daily allocation', async () => {
    const fetch = vi.fn(async () => Response.json({ choices: [{ message: { content: JSON.stringify(answer) } }] }))
    vi.stubGlobal('fetch', fetch)
    const allocationUsed = env(async () => {
      throw new Error('3036: You have used up your daily free allocation of 10,000 neurons.')
    })
    await expect(extractSuggestions(allocationUsed, capture)).resolves.toEqual(expected)

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer test-key')
    const body = JSON.parse(String(init.body))
    expect(body.model).toBe('meta-llama/llama-4-scout')
    expect(body.response_format.type).toBe('json_schema')
    expect(body.provider).toEqual({ require_parameters: true })
  })

  it('does not call OpenRouter when its key is not set, so the capture is retried', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const noKey = env(async () => {
      throw new Error('Workers AI is unavailable')
    }, {})
    await expect(extractSuggestions(noKey, capture)).rejects.toThrow('Workers AI is unavailable')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fails when both Workers AI and OpenRouter fail, so the capture is retried', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":{"message":"Insufficient credits"}}', { status: 402 })))
    const failing = env(async () => {
      throw new Error('Workers AI is unavailable')
    })
    await expect(extractSuggestions(failing, capture)).rejects.toThrow('OpenRouter returned HTTP 402')
  })

  it('goes straight to OpenRouter when there is no Workers AI binding, as in preview deployments', async () => {
    const fetch = vi.fn(async () => Response.json({ choices: [{ message: { content: JSON.stringify(answer) } }] }))
    vi.stubGlobal('fetch', fetch)
    await expect(extractSuggestions({ OPENROUTER_API_KEY: 'test-key' }, capture)).resolves.toEqual(expected)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('fails clearly when there is neither a Workers AI binding nor an OpenRouter key', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(extractSuggestions({}, capture)).rejects.toThrow('No AI is set up')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fails when OpenRouter answers without a message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ choices: [] })))
    const failing = env(async () => {
      throw new Error('Workers AI is unavailable')
    })
    await expect(extractSuggestions(failing, capture)).rejects.toThrow('OpenRouter response had no answer')
  })
})

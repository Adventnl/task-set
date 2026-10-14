import { afterEach, describe, expect, it, vi } from 'vitest'
import { githubRequest } from '../src/connectors/githubConnector'
import { parseGitHubActivity } from '../src/shared/utils/github'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
function memoryCache() {
  const entries = new Map<string, Response>()
  vi.stubGlobal('location', { origin: 'https://task.test' })
  vi.stubGlobal('caches', { open: async () => ({ match: async (key: string) => entries.get(key)?.clone(), put: async (key: string, value: Response) => { entries.set(key, value.clone()) }, keys: async () => [...entries.keys()], delete: async (key: string) => entries.delete(key) }) })
}
describe('GitHub cached refresh', () => {
  it('rejects corrupt cached activity and unsafe links before rendering it', () => {
    expect(parseGitHubActivity({ pulls: [{}], branches: [], warnings: [], updatedAt: '2026-10-14T00:00:00Z' })).toBeNull()
    expect(parseGitHubActivity({ pulls: [], branches: [{ repository: 'Adventnl/task-set', name: 'topic', base: 'main', ahead: 1, behind: 0, pullUrl: 'javascript:bad' }], warnings: [], updatedAt: '2026-10-14T00:00:00Z' })).toBeNull()
  })
  it('revalidates list responses by ETag and uses the saved body for 304', async () => {
    memoryCache()
    const fetcher = vi.fn(async (_url: string, _init: RequestInit) => Response.json([{ name: 'topic' }], { headers: { ETag: '"version-one"' } }))
    vi.stubGlobal('fetch', fetcher)
    const signal = new AbortController().signal
    await githubRequest('/repos/Adventnl/task-set/branches', '', signal)
    fetcher.mockImplementation(async () => new Response(null, { status: 304 }))
    expect(await githubRequest('/repos/Adventnl/task-set/branches', '', signal)).toEqual([{ name: 'topic' }])
    expect(new Headers(fetcher.mock.calls[1][1].headers).get('If-None-Match')).toBe('"version-one"')
  })
  it('reuses immutable SHA comparisons and fetches when a branch changes', async () => {
    memoryCache()
    const fetcher = vi.fn(async () => Response.json({ ahead_by: 1, behind_by: 0 }))
    vi.stubGlobal('fetch', fetcher)
    const signal = new AbortController().signal
    const path = `/repos/Adventnl/task-set/compare/${'a'.repeat(40)}...${'b'.repeat(40)}?per_page=1`
    await githubRequest(path, '', signal)
    await githubRequest(path, '', signal)
    expect(fetcher).toHaveBeenCalledTimes(1)
    await githubRequest(path.replace('b'.repeat(40), 'c'.repeat(40)), '', signal)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})

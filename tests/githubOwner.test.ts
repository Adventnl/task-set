import { afterEach, describe, expect, it, vi } from 'vitest'
import { githubProxy, validGitHubPath } from '../worker/github'
import { githubRequest } from '../src/connectors/githubConnector'
import { readOwnerGitHubBinding, saveOwnerGitHubBinding, readGitHubSelection, saveGitHubSelection } from '../src/services/githubService'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('owner GitHub access', () => {
  it('saves only the owner and repositories and removes obsolete browser credentials', () => {
    const stored = new Map<string, string>([['task-set:github-binding', 'obsolete-token']])
    vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value), removeItem: (key: string) => stored.delete(key) })
    const binding = { login: 'Adventnl', repositories: [{ id: 1, name: 'Adventnl/task-set', defaultBranch: 'main' }] }
    saveOwnerGitHubBinding(binding)
    expect(readOwnerGitHubBinding()).toEqual(binding)
    expect(stored.has('task-set:github-binding')).toBe(false)
    saveGitHubSelection('Adventnl', [])
    expect(readGitHubSelection('Adventnl')).toEqual([])
  })
  it('limits the proxy to GitHub resources used by the app', () => {
    expect(validGitHubPath('/user/repos?per_page=100&page=2')).toBe(true)
    expect(validGitHubPath('/repos/Adventnl/task-set/compare/main...topic%2Fone?per_page=1')).toBe(true)
    expect(validGitHubPath('//evil.example/user')).toBe(false)
    expect(validGitHubPath('/repos/owner/repo/issues')).toBe(false)
    expect(validGitHubPath('/repos/owner/%2e%2e/pulls')).toBe(false)
  })
  it('reports missing setup without making a GitHub request', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const response = await githubProxy(new Request('https://task.test/api/github?path=%2Fuser'), {})
    expect(response.status).toBe(503)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('rejects a server token for a different owner', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ login: 'someone-else' })))
    expect((await githubProxy(new Request('https://task.test/api/github?path=%2Fuser'), { GITHUB_TOKEN: 'test-other-owner' })).status).toBe(403)
  })
  it('forwards an ETag without returning the server token', async () => {
    const requests = vi.fn(async (url: string, init: RequestInit) => url.endsWith('/user') ? Response.json({ login: 'Adventnl' }) : new Response(null, { status: 304, headers: { ETag: '"same"' } }))
    vi.stubGlobal('fetch', requests)
    const response = await githubProxy(new Request('https://task.test/api/github?path=%2Fuser%2Frepos', { headers: { 'If-None-Match': '"same"' } }), { GITHUB_TOKEN: 'test-owner-token' })
    expect(response.status).toBe(304)
    expect(new Headers(requests.mock.calls[1][1].headers).get('If-None-Match')).toBe('"same"')
    expect(response.headers.get('Authorization')).toBeNull()
  })
  it('uses the authenticated server with no browser token', async () => {
    const fetcher = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ login: 'Adventnl' }))
    vi.stubGlobal('fetch', fetcher)
    await githubRequest('/user', '', new AbortController().signal)
    expect(fetcher.mock.calls[0][0]).toBe('/api/github?path=%2Fuser')
    const init = fetcher.mock.calls[0][1]
    expect(init.credentials).toBe('same-origin')
    expect(new Headers(init.headers).has('Authorization')).toBe(false)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { githubList, githubRequest } from '../src/connectors/githubConnector'
import { bindGitHub, connectGitHub, discoverGitHubRepositories, isGitHubAuthenticationError, loadGitHubActivity, readGitHubBinding, readGitHubSelection, saveGitHubRepositories, saveGitHubSelection } from '../src/services/githubService'
import { checkSummary, mergeStatus, parsePull, parseRepository } from '../src/shared/utils/github'

const repo = { id: 1, full_name: 'owner/repo', default_branch: 'main' }
const pull = { number: 7, title: 'A change', state: 'open', draft: false, head: { ref: 'topic/one', sha: 'abc', repo: { full_name: 'owner/repo' } }, base: { ref: 'main' } }
const signal = () => new AbortController().signal

function mockApi(handler: (url: URL) => unknown | Response) {
  return vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const value = handler(new URL(input))
    return value instanceof Response ? value : Response.json(value)
  }))
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('GitHub adapters', () => {
  it('validates repositories and constructs safe links instead of trusting API URLs', () => {
    expect(parseRepository(repo)).toEqual({ id: 1, name: 'owner/repo', defaultBranch: 'main' })
    expect(() => parseRepository({ ...repo, full_name: 'owner/../../evil' })).toThrow()
    expect(() => parseRepository({ ...repo, id: '1' })).toThrow()
    expect(parsePull({ ...pull, html_url: 'javascript:bad' }, 'owner/repo').mergeUrl).toBe('https://github.com/owner/repo/pull/7#partial-pull-merging')
  })

  it('does not equate unknown mergeability or drafts with a ready PR', () => {
    expect(mergeStatus({ mergeable: null, mergeable_state: 'unknown' })).toBe('Merge status pending')
    expect(mergeStatus({ draft: true, mergeable_state: 'clean' })).toBe('Draft')
    expect(mergeStatus({ mergeable: false })).toBe('Merge conflicts')
    expect(mergeStatus({ mergeable_state: 'blocked' })).toBe('Blocked by repository rules')
  })

  it('combines legacy statuses and check runs without calling absent checks passed', () => {
    expect(checkSummary({ total_count: 0, state: 'pending' }, [])).toBe('No checks reported')
    expect(checkSummary({ total_count: 1, state: 'failure' }, [{ status: 'completed', conclusion: 'success' }])).toBe('Checks need attention')
    expect(checkSummary({ total_count: 0, state: 'pending' }, [{ status: 'in_progress', conclusion: null }])).toBe('Checks pending')
    expect(checkSummary({ total_count: 1, state: 'success' }, [{ status: 'completed', conclusion: 'skipped' }])).toBe('Checks passed')
    expect(checkSummary({ total_count: 0, state: 'pending' }, [{ status: 'completed', conclusion: 'action_required' }])).toBe('Checks need attention')
    expect(checkSummary({ total_count: 0, state: 'pending' }, [{ status: 'completed', conclusion: null }])).toBe('Checks unknown')
  })
})

describe('GitHub connector', () => {
  it('bounds a stalled request and explains that it timed out', async () => {
    const timeout = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal)
    vi.stubGlobal('fetch', vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
    })))
    const request = githubRequest('/user', 't', signal())
    timeout.abort(new DOMException('Timed out', 'TimeoutError'))
    await expect(request).rejects.toThrow('took too long')
  })

  it('keeps cancellation distinct from timeout and reports network failures', async () => {
    const controller = new AbortController()
    controller.abort(new DOMException('Cancelled', 'AbortError'))
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Network error') }))
    await expect(githubRequest('/user', 't', controller.signal)).rejects.toThrow('Cancelled')
    await expect(githubRequest('/user', 't', signal())).rejects.toThrow('Could not reach GitHub')
  })
  it('paginates beyond 100 items and sends credentials only to the GitHub API', async () => {
    mockApi((url) => url.searchParams.get('page') === '1' ? Array.from({ length: 100 }, (_, id) => ({ id })) : [{ id: 100 }])
    expect(await githubList('/user/repos?sort=full_name', 'test-token', signal())).toHaveLength(101)
    expect(fetch).toHaveBeenNthCalledWith(2, 'https://api.github.com/user/repos?sort=full_name&per_page=100&page=2', expect.objectContaining({ credentials: 'omit', headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) }))
    await expect(githubRequest('//evil.test', 'test-token', signal())).rejects.toThrow('Invalid')
  })

  it('paginates check-run envelopes and rejects malformed lists', async () => {
    mockApi(() => ({ check_runs: [{ status: 'completed' }] }))
    expect(await githubList('/repos/o/r/commits/a/check-runs', 't', signal(), 'check_runs')).toHaveLength(1)
    mockApi(() => ({ message: 'unexpected' }))
    await expect(githubList('/user/repos', 't', signal())).rejects.toThrow('unreadable list')
  })

  it.each([401, 403, 429, 404, 500])('reports HTTP %s failures', async (status) => {
    mockApi(() => new Response('', { status }))
    await expect(githubRequest('/user', 't', signal())).rejects.toThrow(/GitHub/)
  })
})

describe('GitHub monitoring', () => {
  it('publishes PRs before slow branch comparisons finish without re-verifying the account', async () => {
    let finish!: (value: Response) => void
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      const path = new URL(input).pathname
      if (path.endsWith('/pulls')) return Response.json([pull])
      if (path.endsWith('/pulls/7')) return Response.json({ ...pull, mergeable: true, mergeable_state: 'clean' })
      if (path.endsWith('/status')) return Response.json({ total_count: 0, state: 'pending' })
      if (path.endsWith('/check-runs')) return Response.json({ check_runs: [] })
      if (path.endsWith('/branches')) return Response.json([{ name: 'topic/one' }])
      if (path.includes('/compare/')) return new Promise<Response>((resolve) => { finish = resolve })
      throw new Error(`Unexpected request ${path}`)
    }))
    const progress = vi.fn()
    const pending = loadGitHubActivity([parseRepository(repo)], 't', signal(), progress)
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    expect(progress.mock.calls[0][0].pulls).toHaveLength(1)
    expect(progress.mock.calls[0][1]).toBe(0)
    finish(Response.json({ ahead_by: 3, behind_by: 1 }))
    const activity = await pending
    expect(progress.mock.lastCall?.[1]).toBe(1)
    expect(activity.branches).toHaveLength(1)
    expect(progress.mock.calls[0][0].branches).toEqual([])
    expect(fetch).not.toHaveBeenCalledWith('https://api.github.com/user', expect.anything())
  })

  it('loads independent repositories concurrently so one slow repository cannot hide others', async () => {
    let finish!: (value: Response) => void
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      const path = new URL(input).pathname
      if (path === '/repos/owner/repo/pulls') return new Promise<Response>((resolve) => { finish = resolve })
      return Response.json([])
    }))
    const progress = vi.fn()
    const pending = loadGitHubActivity([parseRepository(repo), { id: 2, name: 'owner/other', defaultBranch: 'main' }], 't', signal(), progress)
    await vi.waitFor(() => expect(progress.mock.calls.some((call) => call[1] === 1)).toBe(true))
    finish(Response.json([]))
    await pending
    expect(progress.mock.lastCall?.[1]).toBe(2)
  })

  it('rediscovers repositories separately without calling the account endpoint', async () => {
    mockApi((url) => {
      expect(url.pathname).toBe('/user/repos')
      return [repo]
    })
    expect(await discoverGitHubRepositories('t', signal())).toEqual([parseRepository(repo)])
  })
  it('discovers accessible repositories and the connected account', async () => {
    mockApi((url) => url.pathname === '/user' ? { login: 'owner' } : [repo])
    expect(await connectGitHub('t', signal())).toEqual({ login: 'owner', repositories: [parseRepository(repo)] })
  })

  it('loads all PRs, checks, ahead and diverged branches, and links the matching PR', async () => {
    mockApi((url) => {
      if (url.pathname.endsWith('/pulls')) return [pull, { ...pull, number: 8 }]
      if (/\/pulls\/\d+$/.test(url.pathname)) return { ...pull, number: Number(url.pathname.split('/').at(-1)), mergeable: true, mergeable_state: 'clean' }
      if (url.pathname.endsWith('/status')) return { total_count: 1, state: 'success' }
      if (url.pathname.endsWith('/check-runs')) return { check_runs: [{ status: 'completed', conclusion: 'success' }] }
      if (url.pathname.endsWith('/branches')) return [{ name: 'main' }, { name: 'topic/one' }, { name: 'diverged' }, { name: 'behind' }]
      if (decodeURIComponent(url.pathname).endsWith('main...topic/one')) return { ahead_by: 3, behind_by: 0 }
      if (url.pathname.endsWith('main...diverged')) return { ahead_by: 1, behind_by: 2 }
      if (url.pathname.endsWith('main...behind')) return { ahead_by: 0, behind_by: 2 }
      throw new Error(`Unexpected request ${url.pathname}`)
    })
    const activity = await loadGitHubActivity([parseRepository(repo)], 't', signal())
    expect(activity.warnings).toEqual([])
    expect(activity.pulls).toHaveLength(2)
    expect(activity.pulls[0].checks).toBe('Checks passed')
    expect(activity.branches).toHaveLength(2)
    expect(activity.branches.find((branch) => branch.name === 'topic/one')).toMatchObject({ name: 'topic/one', ahead: 3, behind: 0, pullUrl: 'https://github.com/owner/repo/pull/7' })
    expect(activity.branches.find((branch) => branch.name === 'topic/one')?.compareUrl).toContain('main...topic%2Fone')
    expect(activity.branches.find((branch) => branch.name === 'diverged')).toMatchObject({ ahead: 1, behind: 2, pullUrl: null })
  })

  it('keeps PRs visible when detail permissions fail, reporting incomplete activity', async () => {
    mockApi((url) => url.pathname.endsWith('/pulls') ? [pull] : new Response('', { status: 403 }))
    const activity = await loadGitHubActivity([parseRepository(repo)], 't', signal())
    expect(activity.pulls).toHaveLength(1)
    expect(activity.pulls[0].mergeStatus).toBe('Merge status pending')
    expect(activity.warnings).toHaveLength(2)
  })

  it('never links an unrelated fork branch with the same name to a local branch', async () => {
    mockApi((url) => {
      if (url.pathname.endsWith('/pulls')) return [{ ...pull, head: { ...pull.head, repo: { full_name: 'fork/repo' } } }]
      if (url.pathname.endsWith('/pulls/7')) return new Response('', { status: 403 })
      if (url.pathname.endsWith('/branches')) return [{ name: 'topic/one' }]
      return { ahead_by: 1, behind_by: 0 }
    })
    expect((await loadGitHubActivity([parseRepository(repo)], 't', signal())).branches[0].pullUrl).toBeNull()
  })

  it('does not turn cancellation into partial success', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(loadGitHubActivity([parseRepository(repo)], 't', controller.signal)).rejects.toThrow()
  })
})


describe('permanent GitHub binding', () => {
  function storage() {
    const values = new Map<string, string>()
    const store = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
    vi.stubGlobal('localStorage', store)
    return store
  }

  it('saves a verified account and restores its token, repositories and choices after reload', async () => {
    storage()
    mockApi((url) => url.pathname === '/user' ? { login: 'owner' } : [repo])
    expect(readGitHubBinding()).toBeNull()
    await bindGitHub('  first-token  ', signal())
    saveGitHubSelection('owner', [])
    expect(readGitHubBinding()).toEqual({ login: 'owner', token: 'first-token', repositories: [parseRepository(repo)] })
    expect(readGitHubSelection('owner')).toEqual([])
    const binding = readGitHubBinding()!
    saveGitHubRepositories(binding, [{ id: 2, name: 'owner/new', defaultBranch: 'main' }])
    expect(readGitHubBinding()).toEqual({ ...binding, repositories: [{ id: 2, name: 'owner/new', defaultBranch: 'main' }] })
  })

  it('allows renewing the same account but rejects a different account without overwriting the binding', async () => {
    storage()
    mockApi((url) => url.pathname === '/user' ? { login: 'owner' } : [repo])
    await bindGitHub('first', signal())
    await bindGitHub('renewed', signal())
    mockApi((url) => url.pathname === '/user' ? { login: 'different' } : [repo])
    await expect(bindGitHub('other', signal())).rejects.toThrow('bound to owner')
    expect(readGitHubBinding()?.token).toBe('renewed')
    expect(readGitHubBinding()?.login).toBe('owner')
  })

  it('keeps the first completed binding when two account connections race', async () => {
    storage()
    let finishFirst!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn(async (input: string, init: RequestInit) => {
      if (new URL(input).pathname !== '/user') return Response.json([repo])
      const authorization = new Headers(init.headers).get('Authorization')
      if (authorization === 'Bearer slow') return new Promise<Response>((resolve) => { finishFirst = resolve })
      return Response.json({ login: 'owner' })
    }))
    const first = bindGitHub('slow', signal())
    await bindGitHub('fast', signal())
    finishFirst(Response.json({ login: 'different' }))
    await expect(first).rejects.toThrow('bound to owner')
    expect(readGitHubBinding()?.token).toBe('fast')
  })

  it('does not save rejected or cancelled connections', async () => {
    storage()
    mockApi(() => new Response('', { status: 401 }))
    await expect(bindGitHub('invalid', signal())).rejects.toThrow('GitHub rejected')
    expect(readGitHubBinding()).toBeNull()
    mockApi((url) => url.pathname === '/user' ? { login: 'owner' } : [repo])
    const controller = new AbortController()
    controller.abort()
    await expect(bindGitHub('cancelled', controller.signal)).rejects.toThrow()
    expect(readGitHubBinding()).toBeNull()
  })

  it('reports blocked or corrupt storage instead of claiming the account was saved', async () => {
    const store = storage()
    mockApi((url) => url.pathname === '/user' ? { login: 'owner' } : [repo])
    vi.spyOn(store, 'setItem').mockImplementation(() => { throw new Error('Storage blocked') })
    await expect(bindGitHub('t', signal())).rejects.toThrow('Storage blocked')
    expect(readGitHubBinding()).toBeNull()
    vi.stubGlobal('localStorage', { getItem: () => '{broken' })
    expect(() => readGitHubBinding()).toThrow()
  })

  it('requires renewal when credentials expire during activity loading', async () => {
    mockApi((url) => url.pathname.endsWith('/pulls') ? [pull] : new Response('', { status: 401 }))
    const failure = await loadGitHubActivity([parseRepository(repo)], 'expired', signal()).catch((error: unknown) => error)
    expect(isGitHubAuthenticationError(failure)).toBe(true)
  })
})

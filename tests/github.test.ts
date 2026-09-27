import { afterEach, describe, expect, it, vi } from 'vitest'
import { githubList, githubRequest } from '../src/connectors/githubConnector'
import { connectGitHub, loadGitHubActivity } from '../src/services/githubService'
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

afterEach(() => vi.unstubAllGlobals())

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
    expect(activity.branches[0]).toMatchObject({ name: 'topic/one', ahead: 3, behind: 0, pullUrl: 'https://github.com/owner/repo/pull/7' })
    expect(activity.branches[0].compareUrl).toContain('main...topic%2Fone')
    expect(activity.branches[1]).toMatchObject({ ahead: 1, behind: 2, pullUrl: null })
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

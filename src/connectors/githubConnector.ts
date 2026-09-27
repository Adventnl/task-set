import type { GitHubBinding } from '../shared/types/github'
import { githubObject } from '../shared/utils/github'

const API = 'https://api.github.com'

const BINDING_KEY = 'task-set:github-binding'

export class GitHubAuthenticationError extends Error {}

/** Credentials are stored on this device and sent only to GitHub. */
export function readGitHubBindingData(): unknown {
  const stored = localStorage.getItem(BINDING_KEY)
  return stored === null ? null : JSON.parse(stored) as unknown
}

export function saveGitHubBindingData(binding: GitHubBinding): void {
  localStorage.setItem(BINDING_KEY, JSON.stringify(binding))
}

/** A token is supplied for each request and never sent to the Task Set server. */
export async function githubRequest(path: string, token: string, signal: AbortSignal): Promise<unknown> {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid GitHub API path.')
  const response = await fetch(`${API}${path}`, {
    signal, credentials: 'omit', cache: 'no-store', redirect: 'error',
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2026-03-10' },
  })
  if (!response.ok) {
    if (response.status === 401) throw new GitHubAuthenticationError('GitHub rejected the saved token. Renew it for the bound account.')
    if (response.status === 403 || response.status === 429) throw new Error('GitHub denied access or rate-limited requests. Check token permissions or retry later.')
    if (response.status === 404) throw new Error('GitHub could not find this resource. Check repository access.')
    throw new Error(`GitHub request failed (${response.status}). Try refreshing.`)
  }
  return response.json() as Promise<unknown>
}

/** Paginate arrays and check-run envelopes, without following externally supplied URLs. */
export async function githubList(path: string, token: string, signal: AbortSignal, key?: string): Promise<unknown[]> {
  const result: unknown[] = []
  for (let page = 1; ; page++) {
    const body = await githubRequest(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`, token, signal)
    const items = key ? githubObject(body)[key] : body
    if (!Array.isArray(items)) throw new Error('GitHub returned an unreadable list.')
    result.push(...items)
    if (items.length < 100) return result
  }
}

import { GITHUB_OWNER } from '../shared/config/owner'
import type { GitHubActivity, GitHubBinding } from '../shared/types/github'
import { githubObject, parseGitHubActivity } from '../shared/utils/github'

const API = 'https://api.github.com'

const OWNER_KEY = 'task-set:github-owner'

export class GitHubAuthenticationError extends Error {}

export function readOwnerGitHubData(): unknown { try { return JSON.parse(localStorage.getItem(OWNER_KEY) ?? 'null') as unknown } catch { return null } }
export function saveOwnerGitHubData(binding: GitHubBinding): void {
  localStorage.setItem(OWNER_KEY, JSON.stringify(binding))
  // Remove the old browser credential only after automatic server access has succeeded.
  localStorage.removeItem('task-set:github-binding')
}

/** Owner requests use the authenticated Worker. Optional tokens support direct connector consumers. */
export async function githubRequest(path: string, token: string, signal: AbortSignal): Promise<unknown> {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid GitHub API path.')
  const timeout = AbortSignal.timeout(15_000)
  try {
    let key: string | null = null
    try { key = await githubCacheKey(path, token) } catch { /* CacheStorage is optional. */ }
    const saved = key ? await readGitHubResponse(key) : null
    // Commit comparisons are immutable. Reuse them until a branch's head or base SHA changes.
    if (saved && /\/compare\/[a-f0-9]{40}\.\.\.[a-f0-9]{40}(?:\?|$)/i.test(path)) return saved.data
    const combined = AbortSignal.any([signal, timeout])
    combined.throwIfAborted()
    const response = await fetch(token ? `${API}${path}` : `/api/github?path=${encodeURIComponent(path)}`, {
      signal: combined, cache: 'no-store', redirect: 'error',
      headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(saved?.etag ? { 'If-None-Match': saved.etag } : {}), 'X-GitHub-Api-Version': '2026-03-10' },
      credentials: token ? 'omit' : 'same-origin',
    })
    if (response.status === 304 && saved) return saved.data
    if (!response.ok) {
      if (response.status === 401) throw new GitHubAuthenticationError('GitHub rejected access. The owner must renew the server token.')
      if (response.status === 403 || response.status === 429) throw new Error('GitHub denied access or rate-limited requests. Check token permissions or retry later.')
      if (response.status === 404) throw new Error('GitHub could not find this resource. Check repository access.')
      if (response.status === 503) throw new Error('GitHub access has not been configured for this workspace yet.')
      throw new Error(`GitHub request failed (${response.status}). Try refreshing.`)
    }
    const data: unknown = await response.json()
    if (key) await cacheGitHubResponse(key, data, response.headers.get('etag'))
    return data
  } catch (error) {
    signal.throwIfAborted()
    if (timeout.aborted) throw new Error('GitHub took too long to respond. Try refreshing.')
    if (error instanceof TypeError) throw new Error('Could not reach GitHub. Check your connection and try refreshing.')
    throw error
  }
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


const RESPONSE_CACHE = 'task-set:github-responses'
const SNAPSHOT_KEY = 'task-set:github-snapshot:'
export interface GitHubCachedResponse { etag: string | null; data: unknown }

/** CacheStorage keeps GitHub response bodies out of the small localStorage quota. Keys contain no token. */
export async function githubCacheKey(path: string, token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token || `server:${GITHUB_OWNER}`))
  const namespace = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${location.origin}/__github_cache/${namespace}?path=${encodeURIComponent(path)}`
}
export async function readGitHubResponse(key: string): Promise<GitHubCachedResponse | null> {
  try {
    const response = await (await caches.open(RESPONSE_CACHE)).match(key)
    return response ? { etag: response.headers.get('etag'), data: await response.json() as unknown } : null
  } catch { return null } // A cache is optional; failure never blocks a live request.
}
export async function cacheGitHubResponse(key: string, data: unknown, etag: string | null): Promise<void> {
  try {
    const cache = await caches.open(RESPONSE_CACHE)
    await cache.put(key, new Response(JSON.stringify(data), { headers: etag ? { ETag: etag } : {} }))
    const keys = await cache.keys()
    for (const old of keys.slice(0, Math.max(0, keys.length - 500))) await cache.delete(old)
  } catch { /* Live results remain usable when cache storage is full or unavailable. */ }
}
export function readGitHubSnapshot(login: string, ids: number[]): GitHubActivity | null {
  try {
    const stored = JSON.parse(localStorage.getItem(`${SNAPSHOT_KEY}${login}`) ?? 'null') as { ids?: number[]; activity?: GitHubActivity } | null
    if (!stored || JSON.stringify(stored.ids?.slice().sort()) !== JSON.stringify(ids.slice().sort())) return null
    return parseGitHubActivity(stored.activity)
  } catch { return null }
}
export function cacheGitHubSnapshot(login: string, ids: number[], activity: GitHubActivity) {
  localStorage.setItem(`${SNAPSHOT_KEY}${login}`, JSON.stringify({ ids, activity }))
}

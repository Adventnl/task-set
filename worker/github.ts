import { GITHUB_OWNER } from '../src/shared/config/owner'
import { json } from './http'

export type GitHubEnv = { GITHUB_TOKEN?: string }
const API = 'https://api.github.com'
const ownerChecks = new Map<string, { owner: string; checkedAt: number }>()

export async function githubProxy(request: Request, env: GitHubEnv): Promise<Response> {
  const url = new URL(request.url)
  const path = url.searchParams.get('path') ?? ''
  if (!validGitHubPath(path)) return json({ error: 'Invalid GitHub resource.' }, 400)
  if (!env.GITHUB_TOKEN) return json({ error: 'Configure GITHUB_TOKEN as a Worker secret to enable automatic GitHub access.' }, 503)
  const owner = GITHUB_OWNER
  const checked = ownerChecks.get(env.GITHUB_TOKEN)
  if (!checked || checked.owner !== owner || Date.now() - checked.checkedAt > 300_000) {
    const response = await fetch(`${API}/user`, { headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'Task-Set', 'X-GitHub-Api-Version': '2026-03-10' }, signal: AbortSignal.timeout(15_000) })
    if (!response.ok) return json({ error: 'The configured GitHub token is invalid or unavailable.' }, response.status)
    const user = await response.json() as { login?: string }
    if (user.login?.toLowerCase() !== owner.toLowerCase()) return json({ error: `The server token must belong to ${owner}.` }, 403)
    ownerChecks.clear()
    ownerChecks.set(env.GITHUB_TOKEN, { owner, checkedAt: Date.now() })
  }
  const headers = new Headers({ Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'Task-Set', 'X-GitHub-Api-Version': '2026-03-10' })
  const etag = request.headers.get('if-none-match')
  if (etag) headers.set('If-None-Match', etag)
  const response = await fetch(`${API}${path}`, { headers, redirect: 'error', signal: AbortSignal.timeout(15_000) })
  const returned = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' })
  if (response.headers.get('etag')) returned.set('ETag', response.headers.get('etag')!)
  return new Response(response.status === 304 ? null : response.body, { status: response.status, headers: returned })
}
export function validGitHubPath(path: string): boolean {
  if (path.split('?')[0].split('/').some((part) => part === '..' || part === '.')) return false
  if (path.includes('\\') || path.includes('#') || /%5c|%2e/i.test(path)) return false
  return /^\/(?:user(?:\/repos)?|repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/(?:pulls(?:\/\d+)?|branches|compare\/[^?]+|commits\/[^/?]+\/(?:status|check-runs)))(?:\?[^#]*)?$/.test(path)
}

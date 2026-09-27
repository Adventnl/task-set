import type { GitHubPullRequest, GitHubRepository } from '../types/github'

export function githubObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('GitHub returned an unreadable response.')
  return value as Record<string, unknown>
}

export function githubText(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('GitHub returned an unreadable response.')
  return value
}

export function githubNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('GitHub returned an unreadable response.')
  return value
}

export function repositoryPath(name: string): string {
  const parts = name.split('/')
  if (parts.length !== 2 || parts.some((part) => !/^[\w.-]+$/.test(part))) throw new Error('GitHub returned an invalid repository name.')
  return parts.map(encodeURIComponent).join('/')
}

export function parseRepository(value: unknown): GitHubRepository {
  const repo = githubObject(value)
  const name = githubText(repo.full_name)
  repositoryPath(name)
  return { id: githubNumber(repo.id), name, defaultBranch: githubText(repo.default_branch) }
}

export function parsePull(value: unknown, repository: string): GitHubPullRequest {
  const pull = githubObject(value)
  const head = githubObject(pull.head)
  const base = githubObject(pull.base)
  const number = githubNumber(pull.number)
  const url = `https://github.com/${repositoryPath(repository)}/pull/${number}`
  return {
    number, repository, url, mergeUrl: `${url}#partial-pull-merging`,
    title: githubText(pull.title), head: githubText(head.ref), base: githubText(base.ref),
    headRepository: head.repo ? githubText(githubObject(head.repo).full_name) : null,
    draft: pull.draft === true, mergeStatus: mergeStatus(pull), checks: 'Checks not loaded',
  }
}

export function mergeStatus(pull: Record<string, unknown>): string {
  if (pull.draft === true) return 'Draft'
  if (pull.mergeable === false) return 'Merge conflicts'
  switch (pull.mergeable_state) {
    case 'clean': return 'No merge blockers reported'
    case 'blocked': return 'Blocked by repository rules'
    case 'behind': return 'Base branch update needed'
    case 'unstable': return 'Some checks have not passed'
    case 'dirty': return 'Merge conflicts'
    default: return 'Merge status pending'
  }
}

export function checkSummary(statusValue: unknown, runs: unknown[]): string {
  const status = githubObject(statusValue)
  const count = githubNumber(status.total_count)
  const state = githubText(status.state)
  const checks = runs.map(githubObject)
  if ((count > 0 && ['failure', 'error'].includes(state)) || checks.some((run) => ['failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure', 'stale'].includes(String(run.conclusion)))) return 'Checks need attention'
  if ((count > 0 && state !== 'success') || checks.some((run) => run.status !== 'completed')) return 'Checks pending'
  if (count === 0 && checks.length === 0) return 'No checks reported'
  if (checks.some((run) => !['success', 'neutral', 'skipped'].includes(String(run.conclusion)))) return 'Checks unknown'
  return 'Checks passed'
}

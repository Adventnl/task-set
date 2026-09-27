import { GitHubAuthenticationError, githubList, githubRequest, readGitHubBindingData, saveGitHubBindingData } from '../connectors/githubConnector'
import type { GitHubActivity, GitHubBinding, GitHubBranch, GitHubPullRequest, GitHubRepository } from '../shared/types/github'
import { checkSummary, githubNumber, githubObject, githubText, parsePull, parseRepository, repositoryPath } from '../shared/utils/github'

/** Limit fan-out for PR details and branch comparisons to four concurrent operations. */
async function mapLimited<T, R>(items: T[], operation: (item: T) => Promise<R>, limit = 4): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await operation(items[index])
    }
  }))
  return results
}

export async function connectGitHub(token: string, signal: AbortSignal): Promise<{ login: string; repositories: GitHubRepository[] }> {
  const user = githubObject(await githubRequest('/user', token, signal))
  return { login: githubText(user.login), repositories: await discoverGitHubRepositories(token, signal) }
}

/** Repository discovery is separate from account verification and activity refresh. */
export async function discoverGitHubRepositories(token: string, signal: AbortSignal): Promise<GitHubRepository[]> {
  return (await githubList('/user/repos?sort=full_name&affiliation=owner,collaborator,organization_member', token, signal))
    .filter((value) => githubObject(value).disabled !== true)
    .map(parseRepository)
    .sort((a, b) => a.name.localeCompare(b.name))
}

function failure(error: unknown, signal: AbortSignal): string {
  signal.throwIfAborted()
  if (error instanceof GitHubAuthenticationError) throw error
  return error instanceof Error ? error.message : 'Could not load GitHub activity.'
}

export async function loadGitHubActivity(repositories: GitHubRepository[], token: string, parentSignal: AbortSignal, onProgress?: (activity: GitHubActivity, completed: number) => void): Promise<GitHubActivity> {
  const controller = new AbortController()
  const signal = AbortSignal.any([parentSignal, controller.signal])
  const pulls = new Map<string, GitHubPullRequest[]>()
  const branches: GitHubBranch[] = []
  const warnings: string[] = []
  let completed = 0
  const snapshot = (): GitHubActivity => ({
    pulls: repositories.flatMap((repo) => pulls.get(repo.name) ?? []),
    branches: [...branches].sort((a, b) => a.repository.localeCompare(b.repository) || a.name.localeCompare(b.name)),
    warnings: [...warnings], updatedAt: new Date().toISOString(),
  })
  const progress = () => { signal.throwIfAborted(); onProgress?.(snapshot(), completed) }
  try {
    await mapLimited(repositories, async (repo) => {
      signal.throwIfAborted()
      const path = `/repos/${repositoryPath(repo.name)}`
      let repoPulls: GitHubPullRequest[] = []
      try {
        repoPulls = (await githubList(`${path}/pulls?state=open&sort=updated&direction=desc`, token, signal)).map((value) => parsePull(value, repo.name))
        pulls.set(repo.name, repoPulls)
        progress()
        const detailed = await mapLimited(repoPulls, async (pull) => {
          try {
            const detail = githubObject(await githubRequest(`${path}/pulls/${pull.number}`, token, signal))
            // The PR may close between listing and fetching details.
            if (detail.state !== 'open') return null
            const result = parsePull(detail, repo.name)
            try {
              const sha = encodeURIComponent(githubText(githubObject(detail.head).sha))
              const statuses = await githubRequest(`${path}/commits/${sha}/status`, token, signal)
              const checks = await githubList(`${path}/commits/${sha}/check-runs?filter=latest`, token, signal, 'check_runs')
              result.checks = checkSummary(statuses, checks)
            } catch (error) {
              warnings.push(`${repo.name} #${pull.number}: ${failure(error, signal)} Checks unavailable.`)
            }
            return result
          } catch (error) {
            warnings.push(`${repo.name} #${pull.number}: ${failure(error, signal)} Merge status unavailable.`)
            return pull
          }
        })
        repoPulls = detailed.filter((pull): pull is GitHubPullRequest => pull !== null)
        pulls.set(repo.name, repoPulls)
        progress()
      } catch (error) {
        warnings.push(`${repo.name}: ${failure(error, signal)} Pull requests unavailable.`)
      }
      try {
        const names = (await githubList(`${path}/branches`, token, signal)).map((value) => githubText(githubObject(value).name)).filter((name) => name !== repo.defaultBranch)
        await mapLimited(names, async (name): Promise<GitHubBranch | null> => {
          try {
            const comparison = `${encodeURIComponent(repo.defaultBranch)}...${encodeURIComponent(name)}`
            const result = githubObject(await githubRequest(`${path}/compare/${comparison}?per_page=1`, token, signal))
            const ahead = githubNumber(result.ahead_by)
            if (!ahead) return null
            const pull = repoPulls.find((item) => item.headRepository === repo.name && item.head === name)
            const branch = { repository: repo.name, name, base: repo.defaultBranch, ahead, behind: githubNumber(result.behind_by), compareUrl: `https://github.com/${repositoryPath(repo.name)}/compare/${comparison}`, pullUrl: pull?.url ?? null }
            branches.push(branch)
            progress()
            return branch
          } catch (error) {
            warnings.push(`${repo.name} (${name}): ${failure(error, signal)} Comparison unavailable.`)
            return null
          }
        })
      } catch (error) {
        warnings.push(`${repo.name}: ${failure(error, signal)} Branches unavailable.`)
      }
      completed++
      progress()
    }, 2)
    return snapshot()
  } finally {
    controller.abort()
  }
}

export function saveGitHubRepositories(binding: GitHubBinding, repositories: GitHubRepository[]): void {
  saveGitHubBindingData({ ...binding, repositories })
}

/** Repository choices are kept separately from the account binding for compatibility. */
export function readGitHubSelection(login: string): number[] | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`task-set:github:${login}`) ?? 'null')
    return Array.isArray(value) && value.every((id) => typeof id === 'number' && Number.isSafeInteger(id)) ? value : null
  } catch {
    return null
  }
}

export function saveGitHubSelection(login: string, ids: number[]): void {
  localStorage.setItem(`task-set:github:${login}`, JSON.stringify(ids))
}

/** Invalid or inaccessible storage is reported rather than silently losing the binding. */
export function readGitHubBinding(): GitHubBinding | null {
  const value = readGitHubBindingData()
  if (value === null) return null
  const binding = githubObject(value)
  const login = githubText(binding.login)
  const token = githubText(binding.token)
  if (!/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(login) || !Array.isArray(binding.repositories)) throw new Error('The saved GitHub binding is unreadable.')
  const repositories = binding.repositories.map((value) => {
    const repo = githubObject(value)
    return parseRepository({ id: repo.id, full_name: repo.name, default_branch: repo.defaultBranch })
  })
  return { login, token, repositories }
}

export function assertGitHubAccount(login: string, boundLogin: string): void {
  if (login.toLowerCase() !== boundLogin.toLowerCase()) throw new Error(`GitHub is bound to ${boundLogin}. Use a token for that account.`)
}

export async function bindGitHub(token: string, signal: AbortSignal): Promise<GitHubBinding> {
  const connection = await connectGitHub(token.trim(), signal)
  signal.throwIfAborted()
  const saved = readGitHubBinding()
  if (saved) assertGitHubAccount(connection.login, saved.login)
  const binding = { ...connection, token: token.trim() }
  saveGitHubBindingData(binding)
  return binding
}

export function isGitHubAuthenticationError(error: unknown): boolean {
  return error instanceof GitHubAuthenticationError
}

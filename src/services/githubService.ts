import { githubList, githubRequest } from '../connectors/githubConnector'
import type { GitHubActivity, GitHubBranch, GitHubPullRequest, GitHubRepository } from '../shared/types/github'
import { checkSummary, githubNumber, githubObject, githubText, parsePull, parseRepository, repositoryPath } from '../shared/utils/github'

/** Limit fan-out for PR details and branch comparisons to four concurrent operations. */
async function mapLimited<T, R>(items: T[], operation: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await operation(items[index])
    }
  }))
  return results
}

export async function connectGitHub(token: string, signal: AbortSignal): Promise<{ login: string; repositories: GitHubRepository[] }> {
  const user = githubObject(await githubRequest('/user', token, signal))
  const repositories = (await githubList('/user/repos?sort=full_name&affiliation=owner,collaborator,organization_member', token, signal))
    .filter((value) => githubObject(value).disabled !== true)
    .map(parseRepository)
    .sort((a, b) => a.name.localeCompare(b.name))
  return { login: githubText(user.login), repositories }
}

function failure(error: unknown, signal: AbortSignal): string {
  signal.throwIfAborted()
  return error instanceof Error ? error.message : 'Could not load GitHub activity.'
}

export async function loadGitHubActivity(repositories: GitHubRepository[], token: string, signal: AbortSignal): Promise<GitHubActivity> {
  const pulls: GitHubPullRequest[] = []
  const branches: GitHubBranch[] = []
  const warnings: string[] = []
  for (const repo of repositories) {
    signal.throwIfAborted()
    const path = `/repos/${repositoryPath(repo.name)}`
    let repoPulls: GitHubPullRequest[] = []
    try {
      repoPulls = (await githubList(`${path}/pulls?state=open&sort=updated&direction=desc`, token, signal)).map((value) => parsePull(value, repo.name))
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
      pulls.push(...repoPulls)
    } catch (error) {
      warnings.push(`${repo.name}: ${failure(error, signal)} Pull requests unavailable.`)
    }
    try {
      const names = (await githubList(`${path}/branches`, token, signal)).map((value) => githubText(githubObject(value).name)).filter((name) => name !== repo.defaultBranch)
      const compared = await mapLimited(names, async (name): Promise<GitHubBranch | null> => {
        try {
          const comparison = `${encodeURIComponent(repo.defaultBranch)}...${encodeURIComponent(name)}`
          const result = githubObject(await githubRequest(`${path}/compare/${comparison}?per_page=1`, token, signal))
          const ahead = githubNumber(result.ahead_by)
          if (!ahead) return null
          const pull = repoPulls.find((item) => item.headRepository === repo.name && item.head === name)
          return { repository: repo.name, name, base: repo.defaultBranch, ahead, behind: githubNumber(result.behind_by), compareUrl: `https://github.com/${repositoryPath(repo.name)}/compare/${comparison}`, pullUrl: pull?.url ?? null }
        } catch (error) {
          warnings.push(`${repo.name} (${name}): ${failure(error, signal)} Comparison unavailable.`)
          return null
        }
      })
      branches.push(...compared.filter((branch): branch is GitHubBranch => branch !== null))
    } catch (error) {
      warnings.push(`${repo.name}: ${failure(error, signal)} Branches unavailable.`)
    }
  }
  return { pulls, branches, warnings, updatedAt: new Date().toISOString() }
}

/** Only repository choices are remembered on this device; credentials and activity are not. */
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

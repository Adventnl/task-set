export interface GitHubRepository {
  id: number
  name: string
  defaultBranch: string
}

export interface GitHubPullRequest {
  number: number
  title: string
  repository: string
  head: string
  base: string
  headRepository: string | null
  url: string
  mergeUrl: string
  draft: boolean
  mergeStatus: string
  checks: string
}

export interface GitHubBranch {
  repository: string
  name: string
  base: string
  ahead: number
  behind: number
  compareUrl: string
  pullUrl: string | null
}

export interface GitHubActivity {
  pulls: GitHubPullRequest[]
  branches: GitHubBranch[]
  warnings: string[]
  updatedAt: string
}

export interface GitHubBinding {
  login: string
  token: string
  repositories: GitHubRepository[]
}

// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGitHub } from '../src/shared/hooks/useGitHub'
import { connectOwnerGitHub, discoverGitHubRepositories, loadGitHubActivity, restoreGitHubActivity, saveGitHubActivity, saveGitHubSelection, saveOwnerGitHubBinding } from '../src/services/githubService'
import type { GitHubActivity } from '../src/shared/types/github'

vi.mock('../src/services/githubService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/services/githubService')>(),
  connectOwnerGitHub: vi.fn(), discoverGitHubRepositories: vi.fn(), loadGitHubActivity: vi.fn(),
}))

const repositories = [{ id: 1, name: 'Adventnl/task-set', defaultBranch: 'main' }]
const binding = { login: 'Adventnl', repositories }
const saved: GitHubActivity = {
  pulls: [], warnings: [], updatedAt: '2026-10-21T00:00:00Z',
  branches: [{ repository: 'Adventnl/task-set', name: 'topic', base: 'main', ahead: 1, behind: 0, compareUrl: 'https://github.com/Adventnl/task-set/compare/main...topic', pullUrl: null }],
}
const fresh: GitHubActivity = { pulls: [], branches: [], warnings: [], updatedAt: '2026-10-22T00:00:00Z' }
let root: Root
let container: HTMLDivElement
let github: ReturnType<typeof useGitHub>
function Probe({ active, signedIn }: { active: boolean; signedIn: boolean }) {
  github = useGitHub(active, signedIn)
  return null
}
async function render(active = true, signedIn = true) {
  await act(async () => { root.render(createElement(StrictMode, null, createElement(Probe, { active, signedIn }))) })
}
function seed() {
  saveOwnerGitHubBinding(binding)
  saveGitHubSelection(binding.login, [1])
  saveGitHubActivity(binding.login, [1], saved)
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  vi.mocked(connectOwnerGitHub).mockResolvedValue(binding)
  vi.mocked(discoverGitHubRepositories).mockResolvedValue(repositories)
  vi.mocked(loadGitHubActivity).mockResolvedValue(fresh)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => { root.unmount() })
  container.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('GitHub cache-first activity', () => {
  it('restores saved results without account verification, repository discovery, or scanning', async () => {
    seed()
    await render()
    expect(github.activity).toEqual(saved)
    expect(github.loading).toBe(false)
    expect(connectOwnerGitHub).not.toHaveBeenCalled()
    expect(discoverGitHubRepositories).not.toHaveBeenCalled()
    expect(loadGitHubActivity).not.toHaveBeenCalled()
  })

  it('keeps the cache across view entry, visibility, network recovery and time passing', async () => {
    seed()
    vi.useFakeTimers()
    await render()
    await render(false)
    await render()
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('online'))
      await vi.advanceTimersByTimeAsync(20 * 60_000)
    })
    expect(github.activity).toEqual(saved)
    expect(loadGitHubActivity).not.toHaveBeenCalled()
    expect(discoverGitHubRepositories).not.toHaveBeenCalled()
  })

  it('fetches on explicit Refresh, persists removals, and does not repeat on re-entry or remount', async () => {
    seed()
    await render()
    await act(async () => { github.refresh() })
    expect(loadGitHubActivity).toHaveBeenCalledTimes(1)
    expect(github.activity).toEqual(fresh)
    expect(restoreGitHubActivity(binding.login, [1])).toEqual(fresh)
    expect(discoverGitHubRepositories).not.toHaveBeenCalled()
    await render(false)
    await render()
    await act(async () => { root.unmount() })
    root = createRoot(container)
    await render()
    expect(github.activity).toEqual(fresh)
    expect(loadGitHubActivity).toHaveBeenCalledTimes(1)
    expect(connectOwnerGitHub).not.toHaveBeenCalled()
  })

  it('loads once when there is no saved activity and only rediscovers on explicit reload', async () => {
    saveOwnerGitHubBinding(binding)
    await render()
    expect(loadGitHubActivity).toHaveBeenCalledTimes(1)
    await render(false)
    await render()
    expect(loadGitHubActivity).toHaveBeenCalledTimes(1)
    expect(discoverGitHubRepositories).not.toHaveBeenCalled()
    await act(async () => { await github.reloadRepositories() })
    expect(discoverGitHubRepositories).toHaveBeenCalledTimes(1)
    expect(loadGitHubActivity).toHaveBeenCalledTimes(1)
  })

  it('connects and scans on a first visit but skips empty repository selections', async () => {
    await render()
    expect(connectOwnerGitHub).toHaveBeenCalledTimes(1)
    expect(loadGitHubActivity).toHaveBeenCalledTimes(1)
    await act(async () => { github.choose([]) })
    await render(false)
    await render()
    expect(loadGitHubActivity).toHaveBeenCalledTimes(1)
    expect(github.selected).toEqual([])
  })

  it('keeps the last saved snapshot and its timestamp when refresh fails or is incomplete', async () => {
    seed()
    await render()
    vi.mocked(loadGitHubActivity).mockRejectedValueOnce(new Error('GitHub unavailable'))
    await act(async () => { github.refresh() })
    expect(github.error).toBe('GitHub unavailable')
    expect(github.activity).toEqual(saved)
    vi.mocked(loadGitHubActivity).mockResolvedValueOnce({ ...fresh, warnings: ['Branches unavailable'] })
    await act(async () => { github.refresh() })
    expect(github.activity?.branches).toEqual(saved.branches)
    expect(github.activity?.updatedAt).toBe(saved.updatedAt)
    expect(github.activity?.warnings).toContain('Branches unavailable')
    expect(restoreGitHubActivity(binding.login, [1])).toEqual(github.activity)
  })

  it('aborts a refresh on exit and ignores late results without overwriting saved data', async () => {
    seed()
    await render()
    let finish!: (activity: GitHubActivity) => void
    vi.mocked(loadGitHubActivity).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    await act(async () => { github.refresh() })
    const signal = vi.mocked(loadGitHubActivity).mock.calls[0][2]
    await render(false)
    expect(signal.aborted).toBe(true)
    await act(async () => { finish(fresh) })
    await render()
    expect(github.activity).toEqual(saved)
    expect(restoreGitHubActivity(binding.login, [1])).toEqual(saved)
    expect(loadGitHubActivity).toHaveBeenCalledTimes(1)
  })

  it('keeps completed results in memory when persistent storage fails', async () => {
    seed()
    await render()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
    await act(async () => { github.refresh() })
    expect(github.storageError).toContain('could not be cached')
    expect(github.activity).toEqual(fresh)
    await render(false)
    await render()
    expect(loadGitHubActivity).toHaveBeenCalledTimes(1)
    expect(github.activity).toEqual(fresh)
  })
})

import { useEffect, useRef, useState } from 'react'
import { connectOwnerGitHub, discoverGitHubRepositories, isGitHubAuthenticationError, loadGitHubActivity, readGitHubSelection, saveGitHubSelection, restoreGitHubActivity, saveGitHubActivity, readOwnerGitHubBinding, saveOwnerGitHubBinding } from '../../services/githubService'
import type { GitHubActivity, GitHubBinding } from '../types/github'

const REFRESH_MS = 60_000

export function useGitHub(active: boolean, signedIn: boolean) {
  const connecting = useRef<AbortController | null>(null)
  const lastDiscovery = useRef(0)
  const [binding, setBinding] = useState<GitHubBinding | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const selection = useRef<number[]>([])
  const [activity, setActivity] = useState<GitHubActivity | null>(null)
  const activityRef = useRef(activity)
  activityRef.current = activity
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [completed, setCompleted] = useState(0)
  const [needsToken, setNeedsToken] = useState(false)
  const [error, setError] = useState('')
  const [storageError, setStorageError] = useState('')
  const [revision, setRevision] = useState(0)
  const [repositories, setRepositories] = useState<GitHubBinding['repositories']>([])

  function updateSelection(ids: number[]) {
    selection.current = ids
    setSelected(ids)
  }

  useEffect(() => {
    if (!signedIn) {
      setBinding(null)
      setRepositories([])
      updateSelection([])
      setActivity(null)
      setNeedsToken(false)
      setError('')
      setStorageError('')
      setBusy(false)
      setLoading(false)
      setDiscovering(false)
    }
    return () => { connecting.current?.abort() }
  }, [signedIn])

  async function connect() {
    if (!signedIn) return
    connecting.current?.abort()
    const controller = new AbortController()
    connecting.current = controller
    setBusy(true)
    setDiscovering(false)
    setError('')
    try {
      const connection = await connectOwnerGitHub(AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]))
      if (controller.signal.aborted) return
      setRepositories(connection.repositories)
      lastDiscovery.current = Date.now()
      const saved = readGitHubSelection(connection.login)
      updateSelection(saved === null ? connection.repositories.map((repo) => repo.id) : saved.filter((id) => connection.repositories.some((repo) => repo.id === id)))
      setNeedsToken(false)
      setBinding(connection)
      setActivity(restoreGitHubActivity(connection.login, selection.current))
      try { saveOwnerGitHubBinding(connection); setStorageError('') } catch { setStorageError('Repository list could not be cached on this device.') }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not connect to the owner?s GitHub account.')
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  useEffect(() => {
    if (!signedIn) return
    const saved = readOwnerGitHubBinding()
    if (saved) {
      setBinding(saved)
      setRepositories(saved.repositories)
      const ids = (readGitHubSelection(saved.login) ?? saved.repositories.map((repo) => repo.id)).filter((id) => saved.repositories.some((repo) => repo.id === id))
      updateSelection(ids)
      setActivity(restoreGitHubActivity(saved.login, ids))
    }
  }, [signedIn])

  useEffect(() => {
    if (active && signedIn && !binding && !busy && !error) void connect()
  }, [active, signedIn, binding, busy, error])

  async function reloadRepositories() {
    if (!binding || discovering) return
    connecting.current?.abort()
    const controller = new AbortController()
    connecting.current = controller
    setDiscovering(true)
    setError('')
    try {
      const found = await discoverGitHubRepositories('', AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]))
      if (controller.signal.aborted) return
      saveOwnerGitHubBinding({ ...binding, repositories: found })
      setRepositories(found)
      lastDiscovery.current = Date.now()
      const selectedAll = repositories.length > 0 && selection.current.length === repositories.length
      choose(selectedAll ? found.map((repo) => repo.id) : selection.current.filter((id) => found.some((repo) => repo.id === id)))
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Could not reload repositories.')
        if (isGitHubAuthenticationError(cause)) setNeedsToken(true)
      }
    } finally {
      if (!controller.signal.aborted) setDiscovering(false)
    }
  }

  function choose(ids: number[]) {
    updateSelection(ids)
    setActivity(binding ? restoreGitHubActivity(binding.login, ids) : null)
    setError('')
    try {
      if (binding) saveGitHubSelection(binding.login, ids)
      setStorageError('')
    } catch {
      setStorageError('Repository choices could not be saved. They will last until you reload.')
    }
  }

  useEffect(() => {
    if (!active || !signedIn || !binding || needsToken) { setLoading(false); return }
    const bound = binding
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    async function refresh() {
      if (document.visibilityState !== 'visible') {
        timer = setTimeout(() => void refresh(), REFRESH_MS)
        return
      }
      setLoading(true)
      setCompleted(0)
      setError('')
      try {
        const previous = activityRef.current
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(90_000)])
        const result = await loadGitHubActivity(repositories.filter((repo) => selected.includes(repo.id)), '', signal, (partial, count) => {
          if (!controller.signal.aborted) { if (!previous) setActivity(partial); setCompleted(count) }
        })
        if (!controller.signal.aborted) {
          const snapshot = previous && result.warnings.length ? { ...previous, warnings: ['Refresh was incomplete. Showing the last saved activity until a complete refresh succeeds.', ...result.warnings] } : result
          setActivity(snapshot)
          try { saveGitHubActivity(bound.login, selected, snapshot); setStorageError('') } catch { setStorageError('Activity loaded, but could not be cached on this device.') }
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof DOMException && cause.name === 'TimeoutError' ? 'GitHub refresh timed out. Loaded results are shown below; select fewer repositories or try again.' : cause instanceof Error ? cause.message : 'Could not refresh GitHub activity.')
          if (isGitHubAuthenticationError(cause)) setNeedsToken(true)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          timer = setTimeout(() => void refresh(), REFRESH_MS)
        }
      }
    }
    void refresh()
    const onVisible = () => { if (document.visibilityState === 'visible') setRevision((value) => value + 1) }
    const onOnline = () => setRevision((value) => value + 1)
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      controller.abort()
      clearTimeout(timer)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active, signedIn, binding, repositories, selected, needsToken, revision])

  useEffect(() => {
    if (!active || !signedIn || !binding || needsToken) return
    const check = () => { if (!document.hidden && Date.now() - lastDiscovery.current > 600_000) { lastDiscovery.current = Date.now(); void reloadRepositories() } }
    check()
    const timer = window.setInterval(check, 600_000)
    return () => window.clearInterval(timer)
  }, [active, signedIn, binding, needsToken])

  return {
    login: binding?.login ?? '', repositories, selected, activity, busy, loading, discovering, completed, needsToken, error, storageError,
    connect, choose, reloadRepositories,
    refresh: () => setRevision((value) => value + 1),
  }
}

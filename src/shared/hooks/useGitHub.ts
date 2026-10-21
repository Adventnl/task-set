import { useEffect, useRef, useState } from 'react'
import { connectOwnerGitHub, discoverGitHubRepositories, isGitHubAuthenticationError, loadGitHubActivity, readGitHubSelection, saveGitHubSelection, restoreGitHubActivity, saveGitHubActivity, readOwnerGitHubBinding, saveOwnerGitHubBinding } from '../../services/githubService'
import type { GitHubActivity, GitHubBinding } from '../types/github'

export function useGitHub(active: boolean, signedIn: boolean) {
  const connecting = useRef<AbortController | null>(null)
  const refreshRequested = useRef(false)
  const [restored, setRestored] = useState(false)
  const [binding, setBinding] = useState<GitHubBinding | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const selection = useRef<number[]>([])
  const [activity, setActivity] = useState<GitHubActivity | null>(null)
  // Only completed/restored snapshots suppress automatic first loads; progressive results do not.
  const snapshotRef = useRef<GitHubActivity | null>(null)
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

  function updateActivity(snapshot: GitHubActivity | null) {
    snapshotRef.current = snapshot
    setActivity(snapshot)
  }

  useEffect(() => {
    if (!signedIn) {
      setBinding(null)
      setRepositories([])
      updateSelection([])
      updateActivity(null)
      setRestored(false)
      refreshRequested.current = false
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
      const saved = readGitHubSelection(connection.login)
      updateSelection(saved === null ? connection.repositories.map((repo) => repo.id) : saved.filter((id) => connection.repositories.some((repo) => repo.id === id)))
      setNeedsToken(false)
      setBinding(connection)
      updateActivity(restoreGitHubActivity(connection.login, selection.current))
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
      updateActivity(restoreGitHubActivity(saved.login, ids))
    }
    setRestored(true)
  }, [signedIn])

  useEffect(() => {
    if (restored && active && signedIn && !binding && !busy && !error) void connect()
  }, [restored, active, signedIn, binding, busy, error])

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
    updateActivity(binding ? restoreGitHubActivity(binding.login, ids) : null)
    setError('')
    try {
      if (binding) saveGitHubSelection(binding.login, ids)
      setStorageError('')
    } catch {
      setStorageError('Repository choices could not be saved. They will last until you reload.')
    }
  }

  useEffect(() => {
    if (!active || !signedIn || !binding || needsToken || discovering || selected.length === 0) { setLoading(false); return }
    // Reopening the view, reconnecting, and time passing never invalidate a saved snapshot.
    if (snapshotRef.current && !refreshRequested.current) { setLoading(false); return }
    refreshRequested.current = false
    const bound = binding
    const controller = new AbortController()
    async function refresh() {
      setLoading(true)
      setCompleted(0)
      setError('')
      try {
        const previous = snapshotRef.current
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(90_000)])
        const result = await loadGitHubActivity(repositories.filter((repo) => selected.includes(repo.id)), '', signal, (partial, count) => {
          if (!controller.signal.aborted) { if (!previous) setActivity(partial); setCompleted(count) }
        })
        if (!controller.signal.aborted) {
          const snapshot = previous && result.warnings.length ? { ...previous, warnings: ['Refresh was incomplete. Showing the last saved activity until a complete refresh succeeds.', ...result.warnings] } : result
          updateActivity(snapshot)
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
        }
      }
    }
    void refresh()
    return () => { controller.abort() }
  }, [active, signedIn, binding, repositories, selected, needsToken, discovering, revision])

  return {
    login: binding?.login ?? '', repositories, selected, activity, busy, loading, discovering, completed, needsToken, error, storageError,
    connect, choose, reloadRepositories,
    refresh: () => { refreshRequested.current = true; setRevision((value) => value + 1) },
  }
}

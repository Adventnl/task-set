import { useEffect, useRef, useState } from 'react'
import { bindGitHub, discoverGitHubRepositories, isGitHubAuthenticationError, loadGitHubActivity, readGitHubBinding, readGitHubSelection, saveGitHubRepositories, saveGitHubSelection } from '../../services/githubService'
import type { GitHubActivity, GitHubBinding } from '../types/github'

const REFRESH_MS = 60_000

export function useGitHub(active: boolean, signedIn: boolean) {
  const connecting = useRef<AbortController | null>(null)
  const [binding, setBinding] = useState<GitHubBinding | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const selection = useRef<number[]>([])
  const [activity, setActivity] = useState<GitHubActivity | null>(null)
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
    if (signedIn) {
      try {
        const saved = readGitHubBinding()
        setBinding(saved)
        setRepositories(saved?.repositories ?? [])
        updateSelection(saved ? (readGitHubSelection(saved.login) ?? saved.repositories.map((repo) => repo.id)).filter((id) => saved.repositories.some((repo) => repo.id === id)) : [])
        setError('')
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not restore the GitHub binding.')
      }
    } else {
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

  async function connect(value: string) {
    if (!signedIn) return
    connecting.current?.abort()
    const controller = new AbortController()
    connecting.current = controller
    setBusy(true)
    setDiscovering(false)
    setError('')
    try {
      const connection = await bindGitHub(value, AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]))
      if (controller.signal.aborted) return
      setRepositories(connection.repositories)
      const saved = readGitHubSelection(connection.login)
      updateSelection(saved === null ? connection.repositories.map((repo) => repo.id) : saved.filter((id) => connection.repositories.some((repo) => repo.id === id)))
      setNeedsToken(false)
      setBinding(connection)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not bind GitHub on this device.')
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  async function reloadRepositories() {
    if (!binding || discovering) return
    connecting.current?.abort()
    const controller = new AbortController()
    connecting.current = controller
    setDiscovering(true)
    setError('')
    try {
      const found = await discoverGitHubRepositories(binding.token, AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]))
      if (controller.signal.aborted) return
      saveGitHubRepositories(binding, found)
      setRepositories(found)
      choose(selection.current.filter((id) => found.some((repo) => repo.id === id)))
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
    setActivity(null)
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
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(90_000)])
        const result = await loadGitHubActivity(repositories.filter((repo) => selected.includes(repo.id)), bound.token, signal, (partial, count) => {
          if (!controller.signal.aborted) { setActivity(partial); setCompleted(count) }
        })
        if (!controller.signal.aborted) setActivity(result)
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

  return {
    login: binding?.login ?? '', repositories, selected, activity, busy, loading, discovering, completed, needsToken, error, storageError,
    connect, choose, reloadRepositories,
    refresh: () => setRevision((value) => value + 1),
  }
}

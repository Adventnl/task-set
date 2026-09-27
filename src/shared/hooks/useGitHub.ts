import { useEffect, useRef, useState } from 'react'
import { assertGitHubAccount, bindGitHub, connectGitHub, isGitHubAuthenticationError, loadGitHubActivity, readGitHubBinding, readGitHubSelection, saveGitHubSelection } from '../../services/githubService'
import type { GitHubActivity, GitHubBinding } from '../types/github'

const REFRESH_MS = 60_000

export function useGitHub(active: boolean, signedIn: boolean) {
  const connecting = useRef<AbortController | null>(null)
  const [binding, setBinding] = useState<GitHubBinding | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [activity, setActivity] = useState<GitHubActivity | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [needsToken, setNeedsToken] = useState(false)
  const [error, setError] = useState('')
  const [storageError, setStorageError] = useState('')
  const [revision, setRevision] = useState(0)
  const [repositories, setRepositories] = useState<GitHubBinding['repositories']>([])

  useEffect(() => {
    if (signedIn) {
      try {
        const saved = readGitHubBinding()
        setBinding(saved)
        setRepositories(saved?.repositories ?? [])
        setSelected(saved ? readGitHubSelection(saved.login) ?? saved.repositories.map((repo) => repo.id) : [])
        setError('')
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not restore the GitHub binding.')
      }
    } else {
      setBinding(null)
      setRepositories([])
      setSelected([])
      setActivity(null)
      setNeedsToken(false)
      setError('')
      setStorageError('')
      setBusy(false)
      setLoading(false)
    }
    return () => { connecting.current?.abort() }
  }, [signedIn])

  async function connect(value: string) {
    if (!signedIn) return
    connecting.current?.abort()
    const controller = new AbortController()
    connecting.current = controller
    setBusy(true)
    setError('')
    try {
      const connection = await bindGitHub(value, controller.signal)
      if (controller.signal.aborted) return
      setRepositories(connection.repositories)
      const saved = readGitHubSelection(connection.login)
      setSelected(saved === null ? connection.repositories.map((repo) => repo.id) : saved.filter((id) => connection.repositories.some((repo) => repo.id === id)))
      setNeedsToken(false)
      setBinding(connection)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not bind GitHub on this device.')
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  function choose(ids: number[]) {
    setSelected(ids)
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
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      setLoading(true)
      setError('')
      try {
        const connection = await connectGitHub(bound.token, controller.signal)
        assertGitHubAccount(connection.login, bound.login)
        if (controller.signal.aborted) return
        setRepositories(connection.repositories)
        const result = await loadGitHubActivity(connection.repositories.filter((repo) => selected.includes(repo.id)), bound.token, controller.signal)
        if (!controller.signal.aborted) setActivity(result)
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not refresh GitHub activity.')
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
  }, [active, signedIn, binding, selected, needsToken, revision])

  return {
    login: binding?.login ?? '', repositories, selected, activity, busy, loading, needsToken, error, storageError,
    connect, choose,
    refresh: () => setRevision((value) => value + 1),
  }
}

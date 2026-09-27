import { useEffect, useRef, useState } from 'react'
import { connectGitHub, loadGitHubActivity, readGitHubSelection, saveGitHubSelection } from '../../services/githubService'
import type { GitHubActivity, GitHubRepository } from '../types/github'

const REFRESH_MS = 60_000

export function useGitHub(active: boolean, signedIn: boolean) {
  const token = useRef('')
  const refreshing = useRef<AbortController | null>(null)
  const connecting = useRef<AbortController | null>(null)
  const [login, setLogin] = useState('')
  const [repositories, setRepositories] = useState<GitHubRepository[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [activity, setActivity] = useState<GitHubActivity | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [storageError, setStorageError] = useState('')
  const [revision, setRevision] = useState(0)

  function disconnect() {
    connecting.current?.abort()
    refreshing.current?.abort()
    token.current = ''
    setLogin('')
    setRepositories([])
    setSelected([])
    setActivity(null)
    setError('')
    setStorageError('')
    setBusy(false)
    setLoading(false)
  }

  useEffect(() => {
    if (!signedIn) disconnect()
    return () => { connecting.current?.abort(); token.current = '' }
  }, [signedIn])

  async function connect(value: string) {
    connecting.current?.abort()
    const controller = new AbortController()
    connecting.current = controller
    setBusy(true)
    setError('')
    try {
      const connection = await connectGitHub(value.trim(), controller.signal)
      if (controller.signal.aborted) return
      token.current = value.trim()
      setRepositories(connection.repositories)
      const saved = readGitHubSelection(connection.login)
      setSelected(saved === null ? connection.repositories.map((repo) => repo.id) : saved.filter((id) => connection.repositories.some((repo) => repo.id === id)))
      setLogin(connection.login)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not connect to GitHub.')
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  function choose(ids: number[]) {
    setSelected(ids)
    setActivity(null)
    setError('')
    try {
      saveGitHubSelection(login, ids)
      setStorageError('')
    } catch {
      setStorageError('Repository choices could not be saved. They will last until you reload.')
    }
  }

  useEffect(() => {
    if (!active || !signedIn || !login || !selected.length) { setLoading(false); return }
    const controller = new AbortController()
    refreshing.current = controller
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      setLoading(true)
      setError('')
      try {
        const result = await loadGitHubActivity(repositories.filter((repo) => selected.includes(repo.id)), token.current, controller.signal)
        if (!controller.signal.aborted) setActivity(result)
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not refresh GitHub activity.')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          timer = setTimeout(() => void refresh(), REFRESH_MS)
        }
      }
    }
    void refresh()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [active, signedIn, login, repositories, selected, revision])

  return {
    login, repositories, selected, activity, busy, loading, error, storageError,
    connect, disconnect, choose,
    refresh: () => setRevision((value) => value + 1),
  }
}

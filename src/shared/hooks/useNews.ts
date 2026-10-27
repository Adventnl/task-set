import { useEffect, useRef, useState } from 'react'
import { newsService } from '../../services/newsService'
import type { NewsCategory, NewsDigest } from '../types/news'

export function useNews(active: boolean, enabled: boolean) {
  const [digest, setDigest] = useState<NewsDigest | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [category, setCategory] = useState<NewsCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const request = useRef<AbortController | null>(null)
  async function load(refresh = false) {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true); setError('')
    try {
      const next = await newsService.load(refresh, controller.signal)
      if (!controller.signal.aborted) setDigest(next)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load AI news.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }
  useEffect(() => {
    if (!enabled) { request.current?.abort(); setDigest(null); setError(''); setLoading(false); return }
    if (!active) return
    void load()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 15 * 60_000)
    return () => { window.clearInterval(timer); request.current?.abort() }
  }, [active, enabled])
  const term = search.trim().toLowerCase()
  const articles = (digest?.articles ?? []).filter((article) =>
    (category === 'all' || article.category === category) &&
    (!term || `${article.title} ${article.summary} ${article.source}`.toLowerCase().includes(term)))
  return { digest, articles, loading, error, category, setCategory, search, setSearch, refresh: () => void load(true) }
}

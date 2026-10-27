// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useNews } from '../src/shared/hooks/useNews'
import { newsService } from '../src/services/newsService'
import type { NewsDigest } from '../src/shared/types/news'

vi.mock('../src/services/newsService', () => ({ newsService: { load: vi.fn() } }))
const digest: NewsDigest = { updatedAt: '2026-10-27T00:00:00Z', attemptedAt: '2026-10-27T00:00:00Z', warnings: [], articles: [
  { id: 'a', feedId: 'models', title: 'Kimi model', summary: '', url: 'https://example.com', source: 'Publisher', publishedAt: '2026-10-27T00:00:00Z', category: 'models' },
] }
let root: Root, container: HTMLDivElement, news: ReturnType<typeof useNews>
function Probe({ active = true, enabled = true }: { active?: boolean; enabled?: boolean }) { news = useNews(active, enabled); return null }
async function render(props = {}) { await act(async () => root.render(createElement(Probe, props))) }
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  vi.mocked(newsService.load).mockResolvedValue(digest)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.clearAllMocks(); vi.unstubAllGlobals() })
it('loads only while active, filters locally and keeps stories on refresh failure', async () => {
  await render({ active: false }); expect(newsService.load).not.toHaveBeenCalled()
  await render(); expect(news.articles).toHaveLength(1)
  await act(async () => news.setCategory('funding')); expect(news.articles).toHaveLength(0)
  await act(async () => { news.setCategory('all'); news.setSearch('kimi') }); expect(news.articles).toHaveLength(1)
  vi.mocked(newsService.load).mockRejectedValueOnce(new Error('Offline'))
  await act(async () => news.refresh())
  expect(news.error).toBe('Offline'); expect(news.digest).toEqual(digest)
})
it('aborts abandoned requests and clears news on sign-out', async () => {
  let resolve!: (value: NewsDigest) => void
  vi.mocked(newsService.load).mockImplementationOnce(() => new Promise((done) => { resolve = done }))
  await render()
  const signal = vi.mocked(newsService.load).mock.calls[0][1]
  await render({ active: false })
  expect(signal.aborted).toBe(true)
  await act(async () => resolve(digest))
  expect(news.digest).toBeNull()
  await render(); expect(news.digest).toEqual(digest)
  await render({ enabled: false }); expect(news.digest).toBeNull()
})

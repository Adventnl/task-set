import { afterEach, describe, expect, it, vi } from 'vitest'
import { NEWS_FEEDS, parseNewsFeed } from '../worker/newsFeeds'
import { EMPTY_NEWS, mergeNews, newsIsDue, NewsStore } from '../worker/newsStore'
import type { NewsArticle, NewsDigest } from '../src/shared/types/news'

const now = Date.parse('2026-10-26T20:00:00Z')
const feed = NEWS_FEEDS[0]
const rss = (title = 'Kimi releases a model', link = 'https://example.com/model', date = new Date(now).toUTCString()) => `<rss><channel><title>News</title><item><title><![CDATA[${title}]]></title><link>${link}</link><pubDate>${date}</pubDate><source url="https://example.com">Publisher</source><description><![CDATA[<p>A new model &amp; tools</p>]]></description></item></channel></rss>`
const article = (patch: Partial<NewsArticle> = {}): NewsArticle => ({ id: 'a', feedId: feed.id, title: 'New model', summary: '', url: 'https://example.com/model', source: 'Publisher', publishedAt: new Date(now).toISOString(), category: 'models', ...patch })
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('news feed boundary', () => {
  it('parses CDATA, publisher and dates without rendering feed HTML', () => {
    expect(parseNewsFeed(rss(), feed, now)[0]).toMatchObject({ title: 'Kimi releases a model', source: 'Publisher', category: 'models', summary: '' })
    expect(parseNewsFeed(rss(), NEWS_FEEDS[3], now)[0].summary).toBe('A new model & tools')
  })
  it('drops invalid links, dates, old news and future news', () => {
    for (const link of ['javascript:alert(1)', 'http://example.com', 'https://user:password@example.com']) expect(parseNewsFeed(rss('Title', link), feed, now)).toEqual([])
    for (const date of ['invalid', new Date(now - 8 * 86400_000).toUTCString(), new Date(now + 86400_000).toUTCString()]) expect(parseNewsFeed(rss('Title', undefined, date), feed, now)).toEqual([])
  })
  it('rejects malformed XML and entity declarations', () => {
    expect(() => parseNewsFeed('<rss>', feed, now)).toThrow()
    expect(() => parseNewsFeed('<!DOCTYPE rss [<!ENTITY x "boom">]><rss/>', feed, now)).toThrow()
    expect(() => parseNewsFeed('<html/>', feed, now)).toThrow()
  })
  it('deduplicates publisher-suffixed headlines and expires stale stories', () => {
    expect(mergeNews([article(), article({ url: 'https://other.test', title: 'New model - Other Publisher' }), article({ title: 'Old', publishedAt: '2025-01-01' })], now)).toHaveLength(1)
  })
})

describe('daily collection', () => {
  it('rolls over at 7 am Auckland in summer and winter', () => {
    for (const [before, after] of [['2026-10-26T17:59:00Z', '2026-10-26T18:00:00Z'], ['2026-06-26T18:59:00Z', '2026-06-26T19:00:00Z']]) {
      const saved = { ...EMPTY_NEWS, updatedAt: new Date(Date.parse(before) - 3600_000).toISOString() }
      expect(newsIsDue(saved, Date.parse(before))).toBe(false)
      expect(newsIsDue(saved, Date.parse(after))).toBe(true)
    }
  })
  it('coalesces collection, persists results and limits repeated manual refreshes', async () => {
    vi.useFakeTimers(); vi.setSystemTime(now)
    let saved: NewsDigest | undefined
    const storage = { get: vi.fn(async () => saved), put: vi.fn(async (_key: string, digest: NewsDigest) => { saved = digest }) } as unknown as DurableObjectStorage
    const fetcher = vi.fn(async () => new Response(rss()))
    vi.stubGlobal('fetch', fetcher)
    const store = new NewsStore(storage)
    const [a, b] = await Promise.all([store.load(), store.load(true)])
    expect(a).toEqual(b); expect(fetcher).toHaveBeenCalledTimes(NEWS_FEEDS.length)
    expect(a.articles).toHaveLength(1)
    await store.load(true)
    expect(fetcher).toHaveBeenCalledTimes(NEWS_FEEDS.length)
    expect(storage.put).toHaveBeenCalledTimes(1)
  })
  it('retains stories from failed sources and preserves the success timestamp on total failure', async () => {
    vi.useFakeTimers(); vi.setSystemTime(now)
    const previous: NewsDigest = { articles: [article()], updatedAt: new Date(now - 86400_000).toISOString(), attemptedAt: null, warnings: [] }
    const storage = { get: async () => previous, put: vi.fn() } as unknown as DurableObjectStorage
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Unavailable', { status: 503 })))
    const digest = await new NewsStore(storage).load()
    expect(digest.articles).toEqual(previous.articles)
    expect(digest.updatedAt).toBe(previous.updatedAt)
    expect(digest.warnings).toHaveLength(NEWS_FEEDS.length)
    expect(newsIsDue(digest, now + 60_000)).toBe(false)
    expect(newsIsDue(digest, now + 301_000)).toBe(true)
  })
})

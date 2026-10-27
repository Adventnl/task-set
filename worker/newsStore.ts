import type { NewsArticle, NewsDigest } from '../src/shared/types/news'
import { fetchNewsFeed, NEWS_FEEDS } from './newsFeeds'

const KEY = 'ai-news-digest'
export const EMPTY_NEWS: NewsDigest = { articles: [], updatedAt: null, attemptedAt: null, warnings: [] }
function morningKey(date: Date): string {
  // Move the day's boundary to 7 am in Auckland, including daylight saving.
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const get = (key: string) => parts.find((part) => part.type === key)?.value ?? ''
  const day = `${get('year')}-${get('month')}-${get('day')}`
  return Number(get('hour')) >= 7 ? day : new Date(Date.parse(`${day}T00:00:00Z`) - 86400_000).toISOString().slice(0, 10)
}
export function newsIsDue(digest: NewsDigest, now: number): boolean {
  if (digest.attemptedAt && now - Date.parse(digest.attemptedAt) < 5 * 60_000) return false
  return !digest.updatedAt || digest.warnings.length > 0 || morningKey(new Date(digest.updatedAt)) !== morningKey(new Date(now))
}
export function mergeNews(articles: NewsArticle[], now: number): NewsArticle[] {
  const seen = new Set<string>()
  return articles.filter((item) => Date.parse(item.publishedAt) >= now - 7 * 86400_000)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .filter((item) => {
      const title = item.title.toLowerCase().replace(/\s+-\s+[^-]+$/, '').replace(/[^\p{L}\p{N}]/gu, '')
      if (seen.has(item.url) || seen.has(title)) return false
      seen.add(item.url); seen.add(title); return true
    }).slice(0, 180)
}
export class NewsStore {
  private pending: Promise<NewsDigest> | null = null
  constructor(private storage: DurableObjectStorage) {}
  async load(force = false): Promise<NewsDigest> {
    if (this.pending) return this.pending
    const previous = await this.storage.get<NewsDigest>(KEY) ?? EMPTY_NEWS
    const now = Date.now()
    const recent = previous.attemptedAt && now - Date.parse(previous.attemptedAt) < 5 * 60_000
    if (recent || (!force && !newsIsDue(previous, now))) return previous
    // Recheck after the storage await: another request may already have started collection.
    if (this.pending) return this.pending
    this.pending = this.refresh(previous, now).finally(() => { this.pending = null })
    return this.pending
  }
  private async refresh(previous: NewsDigest, now: number): Promise<NewsDigest> {
    const results = await Promise.allSettled(NEWS_FEEDS.map((feed) => fetchNewsFeed(feed, now)))
    const articles: NewsArticle[] = [], warnings: string[] = []
    results.forEach((result, index) => {
      const feed = NEWS_FEEDS[index]
      if (result.status === 'fulfilled') articles.push(...result.value)
      else {
        warnings.push(`${feed.name} could not be refreshed. Previously collected stories are kept.`)
        articles.push(...previous.articles.filter((article) => article.feedId === feed.id))
      }
    })
    const digest: NewsDigest = {
      articles: mergeNews(articles, now), warnings, attemptedAt: new Date(now).toISOString(),
      updatedAt: results.some((result) => result.status === 'fulfilled') ? new Date(now).toISOString() : previous.updatedAt,
    }
    await this.storage.put(KEY, digest)
    return digest
  }
}

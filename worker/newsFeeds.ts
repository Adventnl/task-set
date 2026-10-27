import { XMLParser, XMLValidator } from 'fast-xml-parser'
import type { NewsArticle, NewsCategory } from '../src/shared/types/news'

export interface NewsFeed { id: string; name: string; url: string; category: NewsCategory }
const search = (query: string) => `https://news.google.com/rss/search?${new URLSearchParams({ q: `${query} when:7d`, hl: 'en-US', gl: 'US', ceid: 'US:en' })}`
export const NEWS_FEEDS: readonly NewsFeed[] = [
  { id: 'models', name: 'Model news search', category: 'models', url: search('(AI OR LLM) (model release OR OpenAI OR Anthropic OR Gemini OR Kimi OR DeepSeek)') },
  { id: 'apps', name: 'AI app news search', category: 'apps', url: search('(AI OR artificial intelligence) (app launch OR tool launch OR product launch)') },
  { id: 'funding', name: 'AI funding news search', category: 'funding', url: search('(AI OR artificial intelligence) (startup funding OR raises investment OR seed round)') },
  { id: 'techcrunch', name: 'TechCrunch AI', category: 'industry', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { id: 'openai', name: 'OpenAI', category: 'models', url: 'https://openai.com/news/rss.xml' },
  { id: 'huggingface', name: 'Hugging Face', category: 'models', url: 'https://huggingface.co/blog/feed.xml' },
]
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, processEntities: true })
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
}
function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function plain(value: unknown): string {
  return text(value).replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim()
}
function safeUrl(value: unknown): string | null {
  try { const url = new URL(text(value)); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null } catch { return null }
}
export function parseNewsFeed(xml: string, feed: NewsFeed, now: number): NewsArticle[] {
  // Refuse DTD/entity declarations before parsing untrusted publisher XML.
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('Invalid news feed')
  const channel = object(object(object(parser.parse(xml) as unknown).rss).channel)
  if (!('item' in channel) && !('title' in channel)) throw new Error('Not an RSS feed')
  const items: unknown[] = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : []
  return items.slice(0, 100).flatMap((raw): NewsArticle[] => {
    const item = object(raw)
    const url = safeUrl(item.link)
    const title = plain(item.title).slice(0, 300)
    const published = Date.parse(text(item.pubDate))
    if (!url || !title || !Number.isFinite(published) || published > now + 3600_000 || published < now - 7 * 86400_000) return []
    const source = plain(object(item.source)['#text']) || plain(item.source) || feed.name
    const summary = ['models', 'apps', 'funding'].includes(feed.id) ? '' : plain(item.description).slice(0, 600)
    const category = feed.category !== 'industry' ? feed.category
      : /\b(raises?|funding|investment|seed round|series [a-f])\b/i.test(title) ? 'funding'
      : /\b(model|LLM|GPT|Claude|Gemini|Kimi|DeepSeek)\b/i.test(title) ? 'models' : 'industry'
    return [{ id: url, feedId: feed.id, title, summary, url, source, publishedAt: new Date(published).toISOString(), category }]
  })
}
export async function fetchNewsFeed(feed: NewsFeed, now: number): Promise<NewsArticle[]> {
  const response = await fetch(feed.url, { signal: AbortSignal.timeout(15_000), headers: { Accept: 'application/rss+xml, application/xml, text/xml' } })
  if (!response.ok || !response.body) throw new Error(`${feed.name} is unavailable`)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let xml = '', size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 2_000_000) throw new Error('News feed is too large')
      xml += decoder.decode(value, { stream: true })
    }
    xml += decoder.decode()
  } finally { await reader.cancel() }
  return parseNewsFeed(xml, feed, now)
}

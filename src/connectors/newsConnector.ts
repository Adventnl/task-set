import type { NewsDigest } from '../shared/types/news'
import { requestJson } from '../shared/utils/http'

export async function getNews(refresh: boolean, signal: AbortSignal): Promise<NewsDigest> {
  return await requestJson(refresh ? '/api/news/refresh' : '/api/news', { method: refresh ? 'POST' : 'GET', signal }) as NewsDigest
}

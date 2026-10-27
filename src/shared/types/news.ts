export type NewsCategory = 'models' | 'apps' | 'funding' | 'industry'
export interface NewsArticle {
  id: string
  feedId: string
  title: string
  summary: string
  url: string
  source: string
  publishedAt: string
  category: NewsCategory
}
export interface NewsDigest {
  articles: NewsArticle[]
  updatedAt: string | null
  attemptedAt: string | null
  warnings: string[]
}

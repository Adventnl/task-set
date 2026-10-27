import { ArrowUpRight, RefreshCw } from 'lucide-react'
import type { useNews } from '../../../shared/hooks/useNews'
import type { NewsCategory } from '../../../shared/types/news'

const categories: Record<NewsCategory | 'all', string> = { all: 'All news', models: 'Models', apps: 'Apps & tools', funding: 'Funding', industry: 'Industry' }
const date = (value: string) => new Date(value).toLocaleString('en-NZ', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export default function NewsDashboard({ news }: { news: ReturnType<typeof useNews> }) {
  return <section className="news-dashboard" aria-label="AI news dashboard" aria-busy={news.loading}>
    <div className="news-intro">
      <div><p className="news-eyebrow">THE AI BRIEF</p><h2>Your window into AI</h2><p>New models, useful tools, and the companies getting funded.</p></div>
      <button className="button button-secondary" type="button" onClick={news.refresh} disabled={news.loading}><RefreshCw size={16} aria-hidden="true" />{news.loading ? 'Refreshing…' : 'Refresh news'}</button>
    </div>
    <p className="news-status" role="status">{news.digest?.updatedAt ? `Updated ${date(news.digest.updatedAt)}` : news.loading ? 'Finding the latest stories…' : 'No news collected yet.'} · Daily around 7 am NZ time · Last 7 days</p>
    <div className="news-filters" role="group" aria-label="News categories">
      {(Object.keys(categories) as (NewsCategory | 'all')[]).map((id) => <button key={id} type="button" className="button button-quiet" aria-pressed={news.category === id} onClick={() => news.setCategory(id)}>{categories[id]} <span>{(news.digest?.articles ?? []).filter((article) => id === 'all' || article.category === id).length}</span></button>)}
    </div>
    <label className="news-search">Search news<input type="search" placeholder="Search companies, models, or funding…" value={news.search} onChange={(event) => news.setSearch(event.target.value)} /></label>
    {news.error && <p className="form-error" role="alert">{news.error} Use Refresh news to try again.</p>}
    {!!news.digest?.warnings.length && <div className="news-warning" role="status"><strong>Some sources are unavailable</strong>{news.digest.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
    {!news.loading && !news.error && !news.articles.length && <p className="agenda-empty">{news.digest?.articles.length ? 'No stories match these filters.' : 'No recent stories are available. Try refreshing shortly.'}</p>}
    <div className="news-stories">{news.articles.map((article) => <article className="news-story" key={article.id}>
      <div className="news-story-meta"><span className="news-category">{categories[article.category]}</span><span>{article.source}</span><time dateTime={article.publishedAt}>{date(article.publishedAt)}</time></div>
      <h3><a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}<ArrowUpRight size={17} aria-hidden="true" /></a></h3>
      {article.summary && <p>{article.summary}</p>}
      <a className="news-source" href={article.url} target="_blank" rel="noopener noreferrer">Read story <span className="sr-only">about {article.title} (opens in a new tab)</span> ↗</a>
    </article>)}</div>
    <p className="news-footnote">Collected from Google News searches, TechCrunch AI, OpenAI, and Hugging Face. Coverage depends on available feeds; publication times and funding claims come from the linked sources. Refreshes are limited to once every five minutes.</p>
  </section>
}

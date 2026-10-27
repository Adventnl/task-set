import NewsDashboard from '../../components/news/NewsDashboard'
import type { useNews } from '../../shared/hooks/useNews'

export default function NewsScreen({ news }: { news: ReturnType<typeof useNews> }) {
  return <NewsDashboard news={news} />
}

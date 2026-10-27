import { Newspaper, Wallet, CalendarDays, GitPullRequest, ListChecks, ListTodo, MapPin, NotebookText, Users, type LucideIcon } from 'lucide-react'
import { PRIMARY_SECTIONS, SIDEBAR_SECTIONS, VIEW_LABELS, type Section } from '../../../shared/config/views'

const items: Record<Section, { icon: LucideIcon; countLabel: string }> = {
  news: { icon: Newspaper, countLabel: 'stories' },
  feed: { icon: NotebookText, countLabel: 'notes' },
  lists: { icon: ListChecks, countLabel: 'lists' },
  tasks: { icon: ListTodo, countLabel: 'open' },
  calendar: { icon: CalendarDays, countLabel: 'coming up' },
  meetings: { icon: Users, countLabel: 'meetings' },
  github: { icon: GitPullRequest, countLabel: 'open PRs' },
  finances: { icon: Wallet, countLabel: 'unread financial notifications' },
  map: { icon: MapPin, countLabel: 'places' },
}

/** The workspace sections, listed in the sidebar (a drawer on phones). */
export default function ViewNavigation({
  section,
  counts,
  onSelect,
  compact = false,
}: {
  section: Section
  counts: Record<Section, number>
  onSelect: (section: Section) => void
  compact?: boolean
}) {
  function renderItem(id: Section) {
    const { icon: Icon, countLabel } = items[id]
    return (
        <button key={id} className="view-nav-item" type="button" aria-current={section === id ? 'page' : undefined} onClick={() => onSelect(id)}>
          <Icon className="view-nav-icon" size={18} strokeWidth={1.8} aria-hidden="true" />
          <span className="view-nav-label">{VIEW_LABELS[id]}</span>
          {counts[id] > 0 && (
            <span className="view-nav-count" aria-label={`${counts[id]} ${countLabel}`}>
              {counts[id]}
            </span>
          )}
        </button>
    )
  }
  return (
    <nav className="view-nav" aria-label="Views">
      {(compact ? PRIMARY_SECTIONS : SIDEBAR_SECTIONS).map(renderItem)}
    </nav>
  )
}

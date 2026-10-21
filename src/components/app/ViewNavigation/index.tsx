import { CalendarDays, GitPullRequest, ListChecks, ListTodo, MapPin, MoreHorizontal, NotebookText, Users, type LucideIcon } from 'lucide-react'
import { MORE_SECTIONS, PRIMARY_SECTIONS, VIEW_LABELS, type Section } from '../../../shared/config/views'

const items: Record<Section, { icon: LucideIcon; countLabel: string }> = {
  feed: { icon: NotebookText, countLabel: 'notes' },
  lists: { icon: ListChecks, countLabel: 'lists' },
  tasks: { icon: ListTodo, countLabel: 'open' },
  calendar: { icon: CalendarDays, countLabel: 'coming up' },
  meetings: { icon: Users, countLabel: 'meetings' },
  github: { icon: GitPullRequest, countLabel: 'open PRs' },
  map: { icon: MapPin, countLabel: 'places' },
}

/** The workspace sections, listed in the sidebar (a drawer on phones). */
export default function ViewNavigation({
  section,
  counts,
  onSelect,
  overflow = 'disclosure',
}: {
  section: Section
  counts: Record<Section, number>
  onSelect: (section: Section) => void
  overflow?: 'disclosure' | 'expanded' | 'hidden'
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
      {PRIMARY_SECTIONS.map(renderItem)}
      {overflow === 'expanded' && MORE_SECTIONS.map(renderItem)}
      {overflow === 'disclosure' && (
        <details className="view-nav-more" open={MORE_SECTIONS.includes(section) || undefined}>
          <summary className="view-nav-item"><MoreHorizontal className="view-nav-icon" size={18} aria-hidden="true" /><span>More</span></summary>
          <div className="view-nav-more-items">{MORE_SECTIONS.map(renderItem)}</div>
        </details>
      )}
    </nav>
  )
}

import { CalendarDays, ListTodo, NotebookText, Users, type LucideIcon } from 'lucide-react'
import { VIEW_LABELS, type Section } from '../../../shared/config/views'

const items: { id: Section; icon: LucideIcon; countLabel: string }[] = [
  { id: 'feed', icon: NotebookText, countLabel: 'notes' },
  { id: 'tasks', icon: ListTodo, countLabel: 'open' },
  { id: 'calendar', icon: CalendarDays, countLabel: 'coming up' },
  { id: 'meetings', icon: Users, countLabel: 'meetings' },
]

/** Notes, Tasks, Calendar, and Meetings: a vertical list in the sidebar, or a segmented control on phones. */
export default function ViewNavigation({
  section,
  counts,
  variant,
  onSelect,
}: {
  section: Section
  counts: Record<Section, number>
  variant: 'rail' | 'tabs'
  onSelect: (section: Section) => void
}) {
  return (
    <nav className={`view-nav view-nav-${variant}`} aria-label="Views">
      {items.map(({ id, icon: Icon, countLabel }) => (
        <button key={id} className="view-nav-item" type="button" aria-current={section === id ? 'page' : undefined} onClick={() => onSelect(id)}>
          <Icon className="view-nav-icon" size={18} strokeWidth={1.8} aria-hidden="true" />
          <span className="view-nav-label">{VIEW_LABELS[id]}</span>
          {counts[id] > 0 && (
            <span className="view-nav-count" aria-label={`${counts[id]} ${countLabel}`}>
              {counts[id]}
            </span>
          )}
        </button>
      ))}
    </nav>
  )
}

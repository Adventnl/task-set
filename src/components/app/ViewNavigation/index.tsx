import { CalendarClock, CalendarDays, Inbox, MessageSquareText, type LucideIcon } from 'lucide-react'
import { VIEW_LABELS } from '../../../shared/config/views'
import type { TaskView, View } from '../../../shared/types/task'

const items: { id: View; icon: LucideIcon }[] = [
  { id: 'feed', icon: MessageSquareText },
  { id: 'today', icon: CalendarDays },
  { id: 'inbox', icon: Inbox },
  { id: 'upcoming', icon: CalendarClock },
]

/** The four views, as a vertical list in the rail or as tabs above the content on phones. */
export default function ViewNavigation({
  view,
  counts,
  variant,
  onSelect,
}: {
  view: View
  counts: Record<TaskView, number>
  variant: 'rail' | 'tabs'
  onSelect: (view: View) => void
}) {
  return (
    <nav className={`view-nav view-nav-${variant}`} aria-label="Views">
      {items.map(({ id, icon: Icon }) => {
        const count = id === 'feed' ? 0 : counts[id]
        return (
          <button
            key={id}
            className="view-nav-item"
            type="button"
            aria-current={view === id ? 'page' : undefined}
            onClick={() => onSelect(id)}
          >
            <Icon className="view-nav-icon" size={17} strokeWidth={1.8} aria-hidden="true" />
            <span className="view-nav-label">{VIEW_LABELS[id]}</span>
            {count > 0 && (
              <span className="view-nav-count" aria-label={`${count} open`}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

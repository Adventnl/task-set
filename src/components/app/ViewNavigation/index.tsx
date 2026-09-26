import { Archive, ListTodo, NotebookText, type LucideIcon } from 'lucide-react'
import { VIEW_LABELS } from '../../../shared/config/views'
import type { View } from '../../../shared/types/task'

const items: { id: View; icon: LucideIcon; countLabel: string }[] = [
  { id: 'feed', icon: NotebookText, countLabel: 'notes' },
  { id: 'tasks', icon: ListTodo, countLabel: 'open' },
  { id: 'archive', icon: Archive, countLabel: 'archived' },
]

/** Notes, Tasks, and Archive: a vertical list in the sidebar, or a segmented control on phones. */
export default function ViewNavigation({
  view,
  counts,
  variant,
  onSelect,
}: {
  view: View
  counts: Record<View, number>
  variant: 'rail' | 'tabs'
  onSelect: (view: View) => void
}) {
  return (
    <nav className={`view-nav view-nav-${variant}`} aria-label="Views">
      {items.map(({ id, icon: Icon, countLabel }) => (
        <button key={id} className="view-nav-item" type="button" aria-current={view === id ? 'page' : undefined} onClick={() => onSelect(id)}>
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

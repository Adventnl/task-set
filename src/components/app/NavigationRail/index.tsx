import { Check } from 'lucide-react'
import type { SyncStatus as Status } from '../../../shared/types/sync'
import type { TaskView, View } from '../../../shared/types/task'
import SyncStatus from '../SyncStatus'
import ViewNavigation from '../ViewNavigation'

/** Desktop side rail: brand, views, and sync state. Hidden on narrow screens. */
export default function NavigationRail({
  view,
  counts,
  status,
  onSelect,
  onOpenAccount,
}: {
  view: View
  counts: Record<TaskView, number>
  status: Status
  onSelect: (view: View) => void
  onOpenAccount: () => void
}) {
  return (
    <aside className="rail">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <Check size={13} strokeWidth={3} />
        </span>
        Task Set
      </div>
      <ViewNavigation view={view} counts={counts} variant="rail" onSelect={onSelect} />
      <div className="rail-footer">
        <SyncStatus status={status} onOpen={onOpenAccount} />
      </div>
    </aside>
  )
}

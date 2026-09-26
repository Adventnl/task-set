import { Check } from 'lucide-react'
import type { SyncStatus as Status } from '../../../shared/types/sync'
import type { View } from '../../../shared/types/task'
import SyncStatus from '../SyncStatus'
import ViewNavigation from '../ViewNavigation'

/** Desktop side rail: brand, views, and the sync state that opens settings. Hidden on narrow screens. */
export default function NavigationRail({
  view,
  taskCount,
  status,
  onSelect,
  onOpenSettings,
}: {
  view: View
  taskCount: number
  status: Status
  onSelect: (view: View) => void
  onOpenSettings: () => void
}) {
  return (
    <aside className="rail">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <Check size={13} strokeWidth={3} />
        </span>
        Task Set
      </div>
      <ViewNavigation view={view} taskCount={taskCount} variant="rail" onSelect={onSelect} />
      <div className="rail-footer">
        <SyncStatus status={status} onOpen={onOpenSettings} />
      </div>
    </aside>
  )
}

import { Check, Download } from 'lucide-react'
import type { Section } from '../../../shared/config/views'
import type { SyncStatus as Status } from '../../../shared/types/sync'
import SyncStatus from '../SyncStatus'
import ViewNavigation from '../ViewNavigation'

/** Desktop sidebar: brand, views, installing, and the sync state that opens settings. Hidden on narrow screens. */
export default function NavigationRail({
  section,
  counts,
  status,
  onSelect,
  onOpenSettings,
  onInstall,
}: {
  section: Section
  counts: Record<Section, number>
  status: Status
  onSelect: (section: Section) => void
  onOpenSettings: () => void
  /** Present only while the browser offers to install Task Set. */
  onInstall?: () => void
}) {
  return (
    <aside className="rail">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <Check size={13} strokeWidth={3} />
        </span>
        Task Set
      </div>
      <ViewNavigation section={section} counts={counts} variant="rail" onSelect={onSelect} />
      <div className="rail-footer">
        {onInstall && (
          <button className="rail-install" type="button" onClick={onInstall}>
            <Download size={16} aria-hidden="true" />
            Install app
          </button>
        )}
        <SyncStatus status={status} onOpen={onOpenSettings} />
      </div>
    </aside>
  )
}

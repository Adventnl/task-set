import { Download, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { Section } from '../../../shared/config/views'
import type { SyncStatus as Status } from '../../../shared/types/sync'
import SyncStatus from '../SyncStatus'
import ViewNavigation from '../ViewNavigation'

export const NAVIGATION_ID = 'navigation'

/**
 * Brand, views, installing, and the sync state that opens settings. A fixed sidebar on wide
 * screens; on phones a drawer that slides over the page while `open`, so every view has the whole
 * screen. Opening the drawer moves focus to the current view.
 */
export default function NavigationRail({
  section,
  counts,
  status,
  open,
  onSelect,
  onClose,
  onOpenSettings,
  onInstall,
}: {
  section: Section
  counts: Record<Section, number>
  status: Status
  /** Only affects phones, where the sidebar is a drawer. */
  open: boolean
  onSelect: (section: Section) => void
  onClose: () => void
  onOpenSettings: () => void
  /** Present only while the browser offers to install Task Set. */
  onInstall?: () => void
}) {
  const rail = useRef<HTMLElement>(null)

  useEffect(() => {
    if (open) rail.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus()
  }, [open])

  return (
    <>
      <aside ref={rail} id={NAVIGATION_ID} className={`rail${open ? ' is-open' : ''}`} aria-label="Navigation">
        <div className="brand">
          <img className="brand-mark" src="/icons/icon-192.png" alt="" width="24" height="24" />
          Task Set
          <button className="icon-button rail-close" type="button" onClick={onClose} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>
        <ViewNavigation section={section} counts={counts} onSelect={onSelect} />
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
      {open && <div className="rail-scrim" onClick={onClose} aria-hidden="true" />}
    </>
  )
}

import { ChevronLeft, ListChecks, Search, X, type LucideIcon } from 'lucide-react'
import type { RefObject } from 'react'
import type { SyncStatus as Status } from '../../../shared/types/sync'
import SyncStatus from '../SyncStatus'

export interface HeaderAction {
  label: string
  icon: LucideIcon
  onClick: () => void
}

/**
 * View title with search, one optional action for the view, and, in Notes, note selection. A page
 * inside a view (an open meeting) has a back link above its title. On phones the header also carries
 * the sync state and settings, since the rail is hidden.
 */
export default function WorkspaceHeader({
  title,
  detail,
  back,
  action,
  status,
  searchOpen,
  search,
  searchRef,
  selecting,
  onSearchChange,
  onOpenSearch,
  onCloseSearch,
  onToggleSelecting,
  onOpenSettings,
}: {
  title: string
  detail: string
  back?: { label: string; onClick: () => void }
  action?: HeaderAction
  status: Status
  searchOpen: boolean
  search: string
  searchRef: RefObject<HTMLInputElement | null>
  selecting: boolean
  onSearchChange: (value: string) => void
  onOpenSearch: () => void
  onCloseSearch: () => void
  /** Omitted when there is nothing to select. */
  onToggleSelecting?: () => void
  onOpenSettings: () => void
}) {
  return (
    <header className="workspace-header">
      <div className="workspace-title">
        {back && (
          <button className="back-link" type="button" onClick={back.onClick}>
            <ChevronLeft size={18} aria-hidden="true" />
            {back.label}
          </button>
        )}
        <h1>{title}</h1>
        <p>{detail}</p>
      </div>
      <div className="workspace-tools">
        <div className="mobile-only">
          <SyncStatus status={status} compact onOpen={onOpenSettings} />
        </div>
        {action && (
          <button className="icon-button" type="button" onClick={action.onClick} aria-label={action.label} title={action.label}>
            <action.icon size={18} />
          </button>
        )}
        {onToggleSelecting && (
          <button
            className="icon-button"
            type="button"
            onClick={onToggleSelecting}
            aria-pressed={selecting}
            aria-label="Select notes"
            title={selecting ? 'Stop selecting (Esc)' : 'Select notes'}
          >
            <ListChecks size={18} />
          </button>
        )}
        {searchOpen ? (
          <div className="search-field">
            <Search size={16} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search notes"
              aria-label="Search notes and their tasks"
            />
            <button className="icon-button" type="button" onClick={onCloseSearch} aria-label="Close search">
              <X size={16} />
            </button>
          </div>
        ) : (
          <button className="icon-button" type="button" onClick={onOpenSearch} aria-label="Search" title="Search (⌘K)">
            <Search size={18} />
          </button>
        )}
      </div>
    </header>
  )
}

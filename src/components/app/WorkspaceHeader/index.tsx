import { Search, X } from 'lucide-react'
import type { RefObject } from 'react'
import type { SyncStatus as Status } from '../../../shared/types/sync'
import SyncStatus from '../SyncStatus'

/** View title with search. On phones it also carries the sync state, since the rail is hidden. */
export default function WorkspaceHeader({
  title,
  detail,
  status,
  searchOpen,
  search,
  searchRef,
  onSearchChange,
  onOpenSearch,
  onCloseSearch,
  onOpenAccount,
}: {
  title: string
  detail: string
  status: Status
  searchOpen: boolean
  search: string
  searchRef: RefObject<HTMLInputElement | null>
  onSearchChange: (value: string) => void
  onOpenSearch: () => void
  onCloseSearch: () => void
  onOpenAccount: () => void
}) {
  return (
    <header className="workspace-header">
      <div className="workspace-title">
        <h1>{title}</h1>
        <p>{detail}</p>
      </div>
      <div className="workspace-tools">
        <div className="mobile-only">
          <SyncStatus status={status} compact onOpen={onOpenAccount} />
        </div>
        {searchOpen ? (
          <div className="search-field">
            <Search size={16} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search messages and tasks"
              aria-label="Search messages and tasks"
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

import { ChevronLeft, ListChecks, Menu, Search, X, type LucideIcon } from 'lucide-react'
import type { RefObject } from 'react'
import type { SyncStatus as Status } from '../../../shared/types/sync'
import { NAVIGATION_ID } from '../NavigationRail'
import { SYNC_LABELS } from '../SyncStatus'

export interface HeaderAction {
  label: string
  icon: LucideIcon
  onClick: () => void
}

/**
 * View title with search, one optional action for the view, and, in Notes, note selection. A page
 * inside a view (an open meeting) has a back link above its title. On phones a menu button opens
 * the navigation drawer; a dot on it shows when this device is not synced.
 */
export default function WorkspaceHeader({
  title,
  detail,
  back,
  action,
  status,
  navigationOpen,
  navigationRef,
  searchOpen,
  search,
  searchRef,
  selecting,
  onSearchChange,
  onOpenSearch,
  onCloseSearch,
  onToggleSelecting,
  onOpenNavigation,
}: {
  title: string
  detail: string
  back?: { label: string; onClick: () => void }
  action?: HeaderAction
  status: Status
  navigationOpen: boolean
  navigationRef: RefObject<HTMLButtonElement | null>
  searchOpen: boolean
  search: string
  searchRef: RefObject<HTMLInputElement | null>
  selecting: boolean
  onSearchChange: (value: string) => void
  onOpenSearch: () => void
  onCloseSearch: () => void
  /** Omitted when there is nothing to select. */
  onToggleSelecting?: () => void
  onOpenNavigation: () => void
}) {
  const unsynced = status !== 'synced'
  // On phones an open search takes the whole row, and a page with a back link gets a bar of its own.
  const modes = `${searchOpen ? ' is-searching' : ''}${back ? ' has-back' : ''}`
  return (
    <header className={`workspace-header${modes}`}>
      <div className="mobile-only">
        <button
          ref={navigationRef}
          className="icon-button menu-button"
          type="button"
          data-status={status}
          onClick={onOpenNavigation}
          aria-expanded={navigationOpen}
          aria-controls={NAVIGATION_ID}
          aria-label={unsynced ? `Menu. ${SYNC_LABELS[status]}` : 'Menu'}
        >
          <Menu size={22} />
          {unsynced && <span className="sync-dot" aria-hidden="true" />}
        </button>
      </div>
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

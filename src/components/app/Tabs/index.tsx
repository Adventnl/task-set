import type { KeyboardEvent } from 'react'

export interface TabItem<T extends string> {
  id: T
  label: string
  count: number
}

/** The id of a tab's button, which names the panel it shows. */
export function tabId(id: string): string {
  return `tab-${id}`
}

/**
 * Tabs within a view, drawn as an underline so they never look like the view navigation. Arrow keys,
 * Home, and End move between tabs and select as they go.
 */
export default function Tabs<T extends string>({
  label,
  tabs,
  selected,
  panelId,
  onSelect,
}: {
  label: string
  tabs: TabItem<T>[]
  selected: T
  panelId: string
  onSelect: (id: T) => void
}) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((tab) => tab.id === selected)
    const target = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }[event.key]
    if (target === undefined) return
    event.preventDefault()
    const next = tabs[(target + tabs.length) % tabs.length]
    onSelect(next.id)
    document.getElementById(tabId(next.id))?.focus()
  }

  return (
    <div className="tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          id={tabId(tab.id)}
          className="tab"
          type="button"
          role="tab"
          aria-selected={tab.id === selected}
          aria-controls={panelId}
          tabIndex={tab.id === selected ? 0 : -1}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
          {tab.count > 0 && <span className="tab-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  )
}

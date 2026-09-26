import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react'
import type { CalendarItem } from '../../../shared/utils/calendarView'
import { addDays, longDayLabel } from '../../../shared/utils/dates'

/** A day shows this many items; the rest are counted. */
const PREVIEWS = 3
const KEY_STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }

/** A day is narrow, so it names each item; the agenda below adds times. */
function previewText(item: CalendarItem): string {
  if (item.kind === 'event') return item.event.text
  if (item.kind === 'meeting') return item.meeting.title
  return item.task.title
}

function dayName(date: string, today: string, count: number): string {
  return count ? `${longDayLabel(date, today)}, ${count === 1 ? '1 item' : `${count} items`}` : longDayLabel(date, today)
}

/**
 * A month of days, each previewing what is on it; a day with an event is tinted so it stands out.
 * Arrow keys move the selection by a day or a week, across months. A mouse click also moves focus
 * to the composer, so a click and typing add to that day; taps and keys only select.
 */
export default function CalendarMonth({
  monthLabel,
  weekdays,
  weeks,
  items,
  selected,
  today,
  onSelect,
  onShowMonth,
  onShowToday,
}: {
  monthLabel: string
  weekdays: string[]
  weeks: string[][]
  items: Map<string, CalendarItem[]>
  selected: string
  today: string
  onSelect: (date: string, focusComposer: boolean) => void
  onShowMonth: (step: 1 | -1) => void
  onShowToday: () => void
}) {
  const gridRef = useRef<HTMLDivElement>(null)
  const movedByKey = useRef(false)
  const month = selected.slice(0, 7)

  // After an arrow key, focus follows the selection, which may be in a newly shown month.
  useEffect(() => {
    if (!movedByKey.current) return
    movedByKey.current = false
    gridRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"] button')?.focus()
  }, [selected])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = KEY_STEPS[event.key]
    if (step === undefined) return
    event.preventDefault()
    movedByKey.current = true
    onSelect(addDays(selected, step), false)
  }

  function onClick(date: string, event: MouseEvent<HTMLButtonElement>) {
    onSelect(date, (event.nativeEvent as PointerEvent).pointerType === 'mouse')
  }

  return (
    <section className="calendar" aria-labelledby="calendar-month">
      <div className="calendar-bar">
        <h2 id="calendar-month" className="calendar-month" aria-live="polite">
          {monthLabel}
        </h2>
        <button className="button button-secondary button-small" type="button" onClick={onShowToday} disabled={selected === today}>
          Today
        </button>
        <button className="icon-button icon-button-small" type="button" onClick={() => onShowMonth(-1)} aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <button className="icon-button icon-button-small" type="button" onClick={() => onShowMonth(1)} aria-label="Next month">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="calendar-grid" role="grid" aria-labelledby="calendar-month" ref={gridRef} onKeyDown={onKeyDown}>
        <div className="calendar-week" role="row">
          {weekdays.map((weekday) => (
            <span key={weekday} className="calendar-weekday" role="columnheader">
              {weekday}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]} className="calendar-week" role="row">
            {week.map((date) => {
              const dayItems = items.get(date) ?? []
              return (
                <div key={date} className="calendar-cell" role="gridcell" aria-selected={date === selected}>
                  <button
                    className="calendar-day"
                    type="button"
                    tabIndex={date === selected ? 0 : -1}
                    aria-current={date === today ? 'date' : undefined}
                    aria-label={dayName(date, today, dayItems.length)}
                    data-outside={!date.startsWith(month) || undefined}
                    data-events={dayItems.some((item) => item.kind === 'event') || undefined}
                    onClick={(event) => onClick(date, event)}
                  >
                    <span className="calendar-date">{Number(date.slice(8))}</span>
                    {dayItems.length > 0 && (
                      <span className="calendar-previews" aria-hidden="true">
                        {dayItems.slice(0, PREVIEWS).map((item) => (
                          <span key={item.id} className="calendar-preview" data-kind={item.kind}>
                            <span className="calendar-preview-text">{previewText(item)}</span>
                          </span>
                        ))}
                        {dayItems.length > PREVIEWS && <span className="calendar-more">+{dayItems.length - PREVIEWS}</span>}
                      </span>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}

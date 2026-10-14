import CalendarMonth from '../../components/calendar/CalendarMonth'
import DayAgenda from '../../components/calendar/DayAgenda'
import EventEditor from '../../components/calendar/EventEditor'
import type { useCalendarView } from '../../shared/hooks/useCalendarView'
import type { Confirmation } from '../../shared/hooks/useWorkspaceView'
import type { CalendarEvent, EventInput } from '../../shared/types/calendar'
import type { Task } from '../../shared/types/task'
import { NZ_REGIONS, type NzRegion } from '../../shared/utils/nzHolidays'

/** The Calendar view: the month, the selected day, and the event editor. The composer adds to the selected day. */
export default function CalendarScreen({
  calendar,
  today,
  confirm,
  onFocusComposer,
  onOpenMeeting,
  onToggleTask,
  onEditTask,
  onSaveEvent,
  onDeleteEvent,
}: {
  calendar: ReturnType<typeof useCalendarView>
  today: string
  confirm: (confirmation: Confirmation) => void
  onFocusComposer: () => void
  onOpenMeeting: (id: string, date: string) => void
  onToggleTask: (task: Task) => void
  onEditTask: (task: Task) => void
  onSaveEvent: (event: CalendarEvent, input: EventInput) => Promise<void>
  onDeleteEvent: (event: CalendarEvent) => Promise<boolean>
}) {
  const editing = calendar.editing

  return (
    <>
      <div className="region-controls">
        <label htmlFor="anniversary-region">NZ anniversary region</label>
        <select id="anniversary-region" className="text-field" value={calendar.region.region ?? ''} onChange={(event) => calendar.region.choose(event.target.value as NzRegion || null)}><option value="">National holidays only</option>{NZ_REGIONS.map((region) => <option key={region}>{region}</option>)}</select>
        <button className="button button-secondary" type="button" disabled={calendar.region.busy} onClick={() => void calendar.region.detect()}>{calendar.region.busy ? 'Locating…' : 'Use my location'}</button>
      </div>
      {calendar.region.error && <p className="form-error" role="alert">{calendar.region.error}</p>}
      <CalendarMonth
        monthLabel={calendar.monthLabel}
        weekdays={calendar.weekdays}
        weeks={calendar.weeks}
        items={calendar.items}
        selected={calendar.selected}
        today={today}
        onSelect={(date, focusComposer) => {
          calendar.select(date)
          if (focusComposer) onFocusComposer()
        }}
        onShowMonth={calendar.showMonth}
        onShowToday={calendar.showToday}
        onJump={calendar.select}
      />
      <p className="modal-note">Write a date below, e.g. “Dinner on December 22nd”, or choose a day. Birthday entries repeat yearly.</p>
      <DayAgenda
        date={calendar.selected}
        today={today}
        items={calendar.dayItems}
        onEditEvent={calendar.editEvent}
        onOpenMeeting={onOpenMeeting}
        onToggleTask={onToggleTask}
        onEditTask={onEditTask}
      />
      {editing && (
        <EventEditor
          key={editing.id}
          event={editing}
          onClose={calendar.closeEditor}
          onSave={(input) => onSaveEvent(editing, input)}
          onDelete={() => {
            calendar.closeEditor()
            confirm({
              title: 'Delete this event?',
              message: 'It is removed from the calendar on every device.',
              confirmLabel: 'Delete event',
              onConfirm: () => onDeleteEvent(editing),
            })
          }}
        />
      )}
    </>
  )
}

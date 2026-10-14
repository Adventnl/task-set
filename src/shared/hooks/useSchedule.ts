import * as calendar from '../../services/calendarService'
import * as meetings from '../../services/meetingService'
import * as tasks from '../../services/workspaceService'
import { quickCalendarInput } from '../utils/quickCalendar'
import { dateKey, shortDayLabel } from '../utils/dates'
import { MAX_TITLE_LENGTH } from '../utils/records'
import type { CalendarEvent, EventInput } from '../types/calendar'
import type { Meeting, MeetingInput, MeetingNote } from '../types/meeting'
import type { Capture, ComposerTarget } from '../types/task'
import type { useTaskSet } from './useTaskSet'

const KEPT = 'Could not save that on this device. Your words are still in the box; try again.'

/** Calendar and meeting actions, and sending the composer's words where they belong. */
export function useSchedule({ workspace, commit, persist, sendCapture, setNotice }: ReturnType<typeof useTaskSet>, onCalendarAdded: (date: string) => void) {
  /** Resolves false when nothing was saved, so the composer keeps the words. */
  function send(target: ComposerTarget, text: string, kind: Capture['kind']): Promise<boolean> {
    switch (target.kind) {
      case 'task':
        if (text.trim().length > MAX_TITLE_LENGTH) { setNotice(`Keep the task title under ${MAX_TITLE_LENGTH} characters.`); return Promise.resolve(false) }
        return commit(`task:${text}`, () => tasks.saveTask({ captureId: null }, { title: text.trim(), dueAt: null, reminderAt: null, pinned: false }), 'Task created', KEPT)
      case 'meeting': {
        const input = quickCalendarInput(text, target.date, dateKey(new Date()))
        if (text.trim().length > MAX_TITLE_LENGTH) { setNotice(`Keep the meeting name under ${MAX_TITLE_LENGTH} characters.`); return Promise.resolve(false) }
        return commit(`meeting:${text}`, () => meetings.saveMeeting(null, { title: text.trim(), date: input.date, time: null, repeat: null }), 'Meeting added', KEPT)
      }
      case 'note':
        return sendCapture(text, kind)
      case 'event': {
        const input = quickCalendarInput(text, target.date, dateKey(new Date()))
        return commit(`event:${target.date}:${text}`, () => calendar.createEvent(input), `Added to ${shortDayLabel(input.date)}`, KEPT).then((saved) => { if (saved) onCalendarAdded(input.date); return saved })
      }
      case 'meetingNote':
        return commit(
          `meetingNote:${target.meetingId}:${target.date}:${text}`,
          () => meetings.addMeetingNote(target.meetingId, target.date, text),
          'Added to the meeting',
          KEPT,
        )
    }
  }

  /** Throws on failure so the editor can keep its fields and explain. */
  const saveEvent = async (event: CalendarEvent, input: EventInput) => {
    await persist(() => calendar.saveEvent(event, input), 'Saved')
  }

  const deleteEvent = (event: CalendarEvent) =>
    commit(event.id, () => calendar.deleteEvent(event), 'Removed from the calendar', 'Could not delete that. Try again.')

  /** Creates the meeting when `meeting` is null. Resolves to its id; throws on failure so the editor can explain. */
  const saveMeeting = async (meeting: Meeting | null, input: MeetingInput): Promise<string> => {
    const [record] = await persist(() => meetings.saveMeeting(meeting, input), meeting ? 'Meeting saved' : 'Meeting added')
    return record.value.id
  }

  const deleteMeeting = (meeting: Meeting) =>
    commit(meeting.id, () => meetings.deleteMeeting(meeting, workspace.meetingNotes), 'Meeting deleted', 'Could not delete that meeting. Try again.')

  const deleteMeetingNote = (note: MeetingNote) =>
    commit(note.id, () => meetings.deleteMeetingNote(note), 'Note deleted', 'Could not delete that note. Try again.')

  return { send, saveEvent, deleteEvent, saveMeeting, deleteMeeting, deleteMeetingNote }
}

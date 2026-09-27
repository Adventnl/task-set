import * as calendar from '../../services/calendarService'
import * as meetings from '../../services/meetingService'
import type { CalendarEvent, EventInput } from '../types/calendar'
import type { Meeting, MeetingInput, MeetingNote } from '../types/meeting'
import type { Capture, ComposerTarget } from '../types/task'
import { shortDayLabel } from '../utils/dates'
import type { useTaskSet } from './useTaskSet'

const KEPT = 'Could not save that on this device. Your words are still in the box; try again.'

/** Calendar and meeting actions, and sending the composer's words where they belong. */
export function useSchedule({ workspace, commit, persist, sendCapture }: ReturnType<typeof useTaskSet>) {
  /** Resolves false when nothing was saved, so the composer keeps the words. */
  function send(target: ComposerTarget, text: string, kind: Capture['kind']): Promise<boolean> {
    switch (target.kind) {
      case 'note':
        return sendCapture(text, kind)
      case 'event':
        return commit(`event:${target.date}:${text}`, () => calendar.createEvent({ date: target.date, text }), `Added to ${shortDayLabel(target.date)}`, KEPT)
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

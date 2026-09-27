import MeetingDetail from '../../components/meeting/MeetingDetail'
import MeetingEditor from '../../components/meeting/MeetingEditor'
import MeetingList from '../../components/meeting/MeetingList'
import type { useMeetingsView } from '../../shared/hooks/useMeetingsView'
import type { Confirmation } from '../../shared/hooks/useWorkspaceView'
import type { Meeting, MeetingInput, MeetingNote } from '../../shared/types/meeting'

/** The Meetings view: the list, or one meeting's day and notes, and the meeting editor. */
export default function MeetingsScreen({
  meetings,
  today,
  confirm,
  onSaveMeeting,
  onDeleteMeeting,
  onDeleteNote,
}: {
  meetings: ReturnType<typeof useMeetingsView>
  today: string
  confirm: (confirmation: Confirmation) => void
  onSaveMeeting: (meeting: Meeting | null, input: MeetingInput) => Promise<string>
  onDeleteMeeting: (meeting: Meeting) => Promise<boolean>
  onDeleteNote: (note: MeetingNote) => Promise<boolean>
}) {
  const { meeting, detail, editor } = meetings

  return (
    <>
      {meeting && detail ? (
        <MeetingDetail
          detail={detail}
          today={today}
          onPickDate={meetings.pickDate}
          onDeleteNote={(note) =>
            confirm({
              title: 'Delete this note?',
              message: 'It is deleted from the meeting on every device.',
              confirmLabel: 'Delete note',
              onConfirm: () => onDeleteNote(note),
            })
          }
        />
      ) : (
        <MeetingList sections={meetings.sections} today={today} onOpen={(id) => meetings.openMeeting(id)} onAdd={meetings.startNew} />
      )}
      {editor && (
        <MeetingEditor
          key={editor.meeting?.id ?? 'new'}
          meeting={editor.meeting}
          defaultDate={today}
          today={today}
          onClose={meetings.closeEditor}
          onSave={async (input) => {
            const id = await onSaveMeeting(editor.meeting, input)
            if (!editor.meeting) meetings.openMeeting(id) // a new meeting opens, ready for notes
          }}
          onDelete={() => {
            const existing = editor.meeting
            meetings.closeEditor()
            if (!existing) return
            confirm({
              title: `Delete “${existing.title}”?`,
              message: 'Its notes are deleted too, on every device.',
              confirmLabel: 'Delete meeting',
              onConfirm: () => onDeleteMeeting(existing),
            })
          }}
        />
      )}
    </>
  )
}

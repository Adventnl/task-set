# Task Set design

Status: implemented in the browser app, 26 September 2026; notes-app redesign and Archive on 27 September 2026, for Mac browsers and as an installable phone app. `task.hanoryx.com` is the target address; it is not deployed yet.

## Intent

Task Set should look and feel like a notes app: a blank page that is always ready for the next thought. Capture is the main action. Tasks grow from captures without hiding or rewriting the original words. The interface is quiet, private, and comfortable in a Mac browser window. It borrows native macOS habits, such as clear focus states and keyboard access, without drawing a fake desktop window inside the page.

## Screen structure

At desktop width, use a softly tinted sidebar and one reading column on a paper-white canvas. Leave the remaining width as open canvas. The sidebar lists **Notes**, **Tasks**, and **Archive** with their counts, followed by **Install app** (only while the browser offers installation) and the sync status, which opens Settings. The main column is approximately 720 px wide under a large view title with a one-line count. Its heading names the current view; avoid dashboards, metrics, and decorative hero content.

Notes is a chronological record of captures, grouped under quiet day headings. Show the original text at a generous reading size with a quiet time label and a hairline between notes. New notes appear at the end and remain visible after sending. Do not turn each note into a floating card or chat bubble. A capture can expand to reveal linked manual tasks, suggested task drafts, a transcript, or a retry action. Those details remain visually subordinate to the source text.

Keep the composer at the bottom of the main column on every view, so talking or typing is always one action away. It is a single rounded field with one primary button: a microphone while the field is empty, and Send once there is text. The empty Notes view shows one short invitation (“A blank page”), with the composer already available. Tasks uses the same column and simple rows with round checkboxes, so switching views does not feel like entering another app. It groups open tasks under **Pinned**, **No date** (newest first), and **Scheduled** (soonest first), showing a heading only for groups that have tasks. Each task row ends with a pin toggle that appears on hover or focus, stays visible once pinned, and is always visible on touch screens.

Completing a task moves it to the **Archive** immediately, off both Tasks and its note, and a dark toast above the composer offers **Undo** for six seconds. The Archive lists completed tasks newest first, struck through, with when they were done and how many days are left; each row has **Restore** and a delete icon. Sixty days after completion a task is deleted for good.

The Notes header has a select button. While selecting, every note gets a round checkbox on its left, tapping anywhere on a note toggles it, and the note's own suggestions and tasks fade back and stop responding. A selection bar replaces the composer with the count, **Select all**, **Delete**, and × to stop; on the narrowest phones Delete shows as its icon alone. Only notes on screen count, so a search narrows what **Select all** and **Delete** touch. The unsent draft in the composer is kept.

AI suggestions sit under their note in one amber-tinted block labeled **Suggested**. Each suggestion is a compact row: title and time on the left; **Create task**, Edit, and a dismiss icon on the right. Open tasks that were created from a note appear under it as checkbox rows. Note actions (make a task, delete) live behind a ⋯ button that appears on hover or focus and is always visible on touch screens.

On narrow windows, the sidebar is replaced by a segmented control (Notes, Tasks, Archive) under the title, and the view title shares a row with a settings button (carrying the sync dot as a badge), select, and search. Dialogs become bottom sheets. Keep the composer and all task actions reachable without horizontal scrolling, and respect the safe areas of phones with notches and home indicators.

## Visual language

| Element | Direction |
| --- | --- |
| Canvas | Paper white (`#fdfcfa`) with a slightly warmer sidebar; near-black in dark appearance. No texture or illustration. |
| Text | Near-black primary text; muted gray for times, metadata, and secondary actions. |
| Accent | One notes-app amber. A deep amber (`--accent`) for text, icons, and focus; a bright amber fill (`--accent-fill`) with dark ink for the primary button, checked boxes, and the selected view. Do not use color to decorate empty space. |
| Type | macOS system font stack (`-apple-system`, `BlinkMacSystemFont`, `system-ui`, sans-serif). Note text 17 px, tasks 16 px, controls 15 px; small metadata at least 12–13 px. View titles 32 px bold (28 px on phones). |
| Spacing | An 8 px rhythm with 12, 16, 24, and 32 px steps. Give the reading column generous outer space. |
| Lines and shape | Fine neutral dividers; small 8–12 px radii on controls. Avoid heavy shadows and oversized pills. |
| Motion | Brief transitions only when they clarify a state change. Respect reduced-motion settings. |

The default composition is light. The appearance follows the system setting unless Settings fixes Light or Dark on that device. All colors are semantic tokens in `src/styles.css`, each written once as a `light-dark()` pair; a fixed choice sets `data-theme` on the root element and points the browser's theme color at the same scheme. Icons should clarify an action and always have an accessible name; text labels are preferable for the main navigation.

## Interaction states

- **Capture:** Text is saved locally before any optional network or AI work. Sending is one action; the text appears immediately in Notes. Enter sends and Shift+Enter adds a line when this does not interfere with input method composition.
- **Task:** A manually created task or an AI suggestion stays linked to its source capture. A suggestion is visibly labeled **Suggested** and can be edited, accepted, or dismissed. A capture may have no task or several tasks.
- **Dates:** A due date and a reminder time are separate fields. Ambiguous date phrases stay unset for review. Tasks puts undated work above scheduled work; overdue work is marked in words as well as color.
- **Voice:** Press and hold the microphone to talk; the words appear live in the composer, and releasing sends them as a note. A quick tap listens hands-free until the stop button is tapped; × cancels. No recording is stored or downloadable. States are shown in plain language: listening, transcribing (fallback browsers only), not synced yet, finding tasks, and try again.
- **Offline and errors:** A local save still succeeds when sync or AI is unavailable. Show a subtle pending or retry state near the affected item, and the overall sync state as a dot with a word in the rail (a dot on the settings button on phones, with an accessible name). Never replace a capture with a spinner or an error page.
- **Completion:** Completing moves a task to the Archive at once, with Undo; restoring, editing, or pinning changes its row immediately. Archiving or deleting a task never erases the source note.

## Mac usability

All controls need visible keyboard focus, sensible tab order, and comfortable pointer targets. The composer should be easy to focus with a desktop shortcut after the core capture flow works. Use semantic headings, form labels, button names, and live announcements for save or processing status. Do not rely on color alone to communicate a draft, completed task, or failed step.

The app installs from the browser through its web app manifest and opens offline through a service worker. Where the browser offers an install prompt (Chrome, Edge), Task Set shows its own **Install app** button in the sidebar and in Settings; elsewhere Settings explains the browser's own install route, and says when the app is already installed. The installed app uses the same design and data model on a phone and a Mac. Native packaging is a later decision based on daily use of the installed web app.

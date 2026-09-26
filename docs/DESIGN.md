# Task Set design

Status: implemented in the browser app, 26 September 2026, for Mac browsers and as an installable phone app. `task.hanoryx.com` is the target address; it is not deployed yet.

## Intent

Task Set should feel like an empty sheet that is always ready for the next thought. Capture is the main action. Tasks grow from captures without hiding or rewriting the original words. The interface is quiet, private, and comfortable in a Mac browser window. It borrows native macOS habits, such as clear focus states and keyboard access, without drawing a fake desktop window inside the page.

## Screen structure

At desktop width, use a narrow navigation rail and one reading column. Leave the remaining width as open canvas. The rail contains **Feed**, **Today**, **Inbox**, and **Upcoming**, followed by a small account or local-data status area when those features exist. The main column is approximately 640–720 px wide. Its heading names the current view; avoid dashboards, metrics, and decorative hero content.

The Feed is a chronological record of captures. Show the original text in a readable row with a quiet time label and a thin divider. New captures appear at the end and remain visible after sending. Do not turn each message into a large floating card or chat bubble. A capture can expand to reveal linked manual tasks, suggested task drafts, a transcript, or a retry action. Those details remain visually subordinate to the source text.

Keep the composer at the bottom of the main column on every view, so talking or typing is always one action away. It is a single rounded field with one primary button: a microphone while the field is empty, and Send once there is text. The empty Feed shows one short invitation to capture a thought, with the composer already available. Today, Inbox, and Upcoming use the same column and simple task rows, so switching views does not feel like entering another app. Today separates Overdue and Done today only when they have tasks; Upcoming groups tasks under day headings.

AI suggestions sit under their message in one quiet tinted block labeled **Suggested**. Each suggestion is a compact row: title and time on the left; **Create task**, Edit, and a dismiss icon on the right. Tasks that were created from a message appear under it as checkbox rows. Message actions (make a task, delete) live behind a ⋯ button that appears on hover or focus and is always visible on touch screens.

On narrow windows, the rail is replaced by tabs above the content, and the view title shares a row with a sync dot and search. Dialogs become bottom sheets. Keep the composer and all task actions reachable without horizontal scrolling, and respect the safe areas of phones with notches and home indicators.

## Visual language

| Element | Direction |
| --- | --- |
| Canvas | White or warm near-white, with no texture or illustration. |
| Text | Near-black primary text; muted gray for times, metadata, and secondary actions. |
| Accent | One restrained blue for focus, links, and the primary action. Do not use color to decorate empty space. |
| Type | macOS system font stack (`-apple-system`, `BlinkMacSystemFont`, `system-ui`, sans-serif). Body text around 15–16 px; small metadata at least 12–13 px. |
| Spacing | An 8 px rhythm with 12, 16, 24, and 32 px steps. Give the reading column generous outer space. |
| Lines and shape | Fine neutral dividers; small 8–12 px radii on controls. Avoid heavy shadows and oversized pills. |
| Motion | Brief transitions only when they clarify a state change. Respect reduced-motion settings. |

The default composition is light. A dark appearance follows the system setting; all colors are semantic tokens in `src/styles.css`, defined once for each appearance. Icons should clarify an action and always have an accessible name; text labels are preferable for the main navigation.

## Interaction states

- **Capture:** Text is saved locally before any optional network or AI work. Sending is one action; the text appears immediately in the Feed. Enter sends and Shift+Enter adds a line when this does not interfere with input method composition.
- **Task:** A manually created task or an AI suggestion stays linked to its source capture. A suggestion is visibly labeled **Suggested** and can be edited, accepted, or dismissed. A capture may have no task or several tasks.
- **Dates:** A due date and a reminder time are separate fields. Ambiguous date phrases stay unset for review. Today shows overdue, due-today, and pinned tasks; Inbox holds tasks needing review or a date; Upcoming shows scheduled work.
- **Voice:** Press and hold the microphone to talk; the words appear live in the composer, and releasing sends them as a message. A quick tap listens hands-free until the stop button is tapped; × cancels. No recording is stored or downloadable. States are shown in plain language: listening, transcribing (fallback browsers only), not synced yet, finding tasks, and try again.
- **Offline and errors:** A local save still succeeds when sync or AI is unavailable. Show a subtle pending or retry state near the affected item, and the overall sync state as a dot with a word in the rail (a dot alone on phones, with an accessible name). Never replace a capture with a spinner or an error page.
- **Completion:** Completing, reopening, editing, or snoozing a task changes its row immediately. Archiving or deleting a task never erases the source capture.

## Mac usability

All controls need visible keyboard focus, sensible tab order, and comfortable pointer targets. The composer should be easy to focus with a desktop shortcut after the core capture flow works. Use semantic headings, form labels, button names, and live announcements for save or processing status. Do not rely on color alone to communicate a draft, completed task, or failed step.

The app installs from the browser through its web app manifest and opens offline through a service worker. The installed app uses the same design and data model on a phone and a Mac. Native packaging is a later decision based on daily use of the installed web app.

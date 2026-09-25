# Task Set design

Status: design direction for the macOS-first web MVP. `task.hanoryx.com` is the proposed address, not a deployed site.

## Intent

Task Set should feel like an empty sheet that is always ready for the next thought. Capture is the main action. Tasks grow from captures without hiding or rewriting the original words. The interface is quiet, private, and comfortable in a Mac browser window. It borrows native macOS habits, such as clear focus states and keyboard access, without drawing a fake desktop window inside the page.

## Screen structure

At desktop width, use a narrow navigation rail and one reading column. Leave the remaining width as open canvas. The rail contains **Feed**, **Today**, **Inbox**, and **Upcoming**, followed by a small account or local-data status area when those features exist. The main column is approximately 640–720 px wide. Its heading names the current view; avoid dashboards, metrics, and decorative hero content.

The Feed is a chronological record of captures. Show the original text in a readable row with a quiet time label and a thin divider. New captures appear at the end and remain visible after sending. Do not turn each message into a large floating card or chat bubble. A capture can expand to reveal linked manual tasks, suggested task drafts, a transcript, or a retry action. Those details remain visually subordinate to the source text.

Keep the composer at the bottom of the main column. It has a generous text area, a clear Send action, and, when voice capture ships, a hold-to-record control. The empty Feed shows one short invitation to capture a thought, with the composer already available. Today, Inbox, and Upcoming use the same column and simple task rows, so switching views does not feel like entering another app.

On narrow windows, collapse the rail into a compact navigation control above the content. Keep the composer and all task actions reachable without horizontal scrolling.

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

The default composition is light. A dark appearance may follow the system setting when its text, dividers, focus ring, and status colors have been checked for contrast. Icons should clarify an action and always have an accessible name; text labels are preferable for the main navigation.

## Interaction states

- **Capture:** Text is saved locally before any optional network or AI work. Sending is one action; the text appears immediately in the Feed. Enter sends and Shift+Enter adds a line when this does not interfere with input method composition.
- **Task:** A manually created task or an AI suggestion stays linked to its source capture. A suggestion is visibly labeled **Suggested** and can be edited, accepted, or dismissed. A capture may have no task or several tasks.
- **Dates:** A due date and a reminder time are separate fields. Ambiguous date phrases stay unset for review. Today shows overdue, due-today, and pinned tasks; Inbox holds tasks needing review or a date; Upcoming shows scheduled work.
- **Voice, when added:** Press and hold to record, release to save. Show saved, transcribing, extracting, ready, and needs-retry states in plain language. Keep the source recording available on its capture device until transcription is safely stored.
- **Offline and errors:** A local save still succeeds when sync or AI is unavailable. Show a subtle pending or retry state near the affected item. Never replace a capture with a spinner or an error page.
- **Completion:** Completing, reopening, editing, or snoozing a task changes its row immediately. Archiving or deleting a task never erases the source capture.

## Mac usability

All controls need visible keyboard focus, sensible tab order, and comfortable pointer targets. The composer should be easy to focus with a desktop shortcut after the core capture flow works. Use semantic headings, form labels, button names, and live announcements for save or processing status. Do not rely on color alone to communicate a draft, completed task, or failed step.

The first browser build may offer installation through a web app manifest once offline loading and update behavior are verified. An installed browser app uses the same design and data model. Native macOS packaging is a later decision based on the browser version in daily use.

# Task Set: product and build plan

Status: revised for a macOS-first web MVP, 24 September 2026. `task.hanoryx.com` is the intended host name; deployment has not been completed.

## The problem

The current workaround is a private Discord group chat: send a message now and hope to find it later. A traditional task app adds too much work at the moment of capture. Task Set should feel like sending a message to yourself, while making the actionable parts easy to find and remember.

For example, at 11 pm, someone says, “I need to change the Cloudflare email tomorrow morning.” The capture appears immediately. Later, transcription and extraction can propose a linked task called “Change the Cloudflare email” and a reminder for 9:00 am tomorrow in the user's local time. The original words remain available, and the task and reminder can be corrected independently.

## Product rules

1. **Capture first.** A saved text or audio capture is never lost because transcription, AI, or sync fails.
2. **The feed is the source.** Every capture remains in a chronological, searchable private feed. A capture may produce zero, one, or several tasks.
3. **AI suggests; the user controls.** The app never silently invents a deadline, deletes a capture, or marks work complete. AI output appears as a visible draft that can be edited or dismissed. A reminder can be proposed when the user's words specify one.
4. **Reminder time is distinct from due time.** “Remind me tomorrow morning” sets a reminder, not a due date. “Due Friday” sets a due date.
5. **Works across devices eventually.** When sync arrives, captures and edits should reach signed-in devices within seconds while online. Local capture continues without a connection.
6. **One person first.** This is a personal workspace, not a group messenger.

## First build: Mac browser MVP

Build the first usable slice for a Mac browser, using the blank-canvas interface in [DESIGN.md](DESIGN.md). The web app can later be hosted at `task.hanoryx.com`. An installable browser app is a useful option after its offline loading and update behavior are tested. A native Mac package is not required to validate the first experience.

The first slice includes a chronological Feed, a one-action text composer, local persistence, and manual tasks linked to captures. A capture should show immediately and survive a reload or browser restart in the same browser profile. Task editing and completion should remain usable when the network is unavailable. Today, Inbox, and Upcoming should stay simple: Today holds overdue, due-today, or pinned tasks; Inbox holds tasks needing a date or review; Upcoming holds scheduled work. A non-actionable note remains only a message.

This first slice stores private data in that browser profile. It does not yet have an account or cross-device sync. Clearing browser site data or losing the device can remove local-only data, so export or a tested sync path is needed before treating it as a durable personal archive. The site being hosted does not itself mean user data has been uploaded.

### First-slice acceptance

- A text capture takes one send action, appears at once, and survives reload and browser restart.
- Captures remain in chronological order and retain their original text after task edits or deletion.
- A capture can be turned into a manual task; task title, due date, pin, completion, and reopening work locally.
- A non-task note can stay in the Feed without a forced task.
- A failed or absent network request never prevents local text capture or task editing.
- Keyboard focus, readable contrast, labels, and a narrow-window layout are checked on a Mac.

## Later phases

### 2. Hosted and offline-ready browser app

Configure `task.hanoryx.com` on the existing domain, serve the app over HTTPS, and verify that the loaded app shell and local capture work when disconnected. Add data export before depending on a single local browser store. Add a manifest and installation support if the browser behavior is reliable. Do not describe the site as live until deployment and checks are complete.

### 3. Accounts and sync

Add sign-in, private account-scoped storage, a local write queue with stable IDs, initial sync, reconnect catch-up, and live updates. The original capture is immutable. For simple task fields, the latest server-accepted edit wins; an unsynced capture must never be silently discarded. A candidate hosted service is Supabase Auth, Postgres, and Realtime, subject to a prototype and current free-tier terms. The browser app should save locally first, then sync. Sign-in should be a requirement for cross-device data, not for opening a public landing page.

### 4. Voice and AI

Implementation status (25 September 2026): Local browser recording, audio playback/download, editable transcripts, draft task suggestions, and a Cloudflare Worker AI connector have been built. AI use requires an explicit click. The Worker is not deployed and hosted Access authentication has not been configured. Browser audio is saved in its native format; MP3 transcoding is not included. The recording remains local because account sync is not present.

Add hold-to-record capture, save the audio locally on release, then transcribe and extract task suggestions. Show saved, transcribing, extracting, ready, and needs-retry states. Until transcription succeeds, the recording remains on its originating device; other synced devices can show a placeholder. Keep the local audio until the transcript is safely stored and synced, then remove it by default unless the user chooses to keep it.

A Cloudflare Worker on the existing domain is the candidate AI endpoint. It should verify the signed-in user and enforce per-user upload and request limits before calling hosted transcription and text models. Model output must be validated, tied to the source capture, and processed idempotently so retries do not create duplicate tasks. If AI is unavailable or at its usage limit, the original capture remains available for retry or manual task creation. Confirm model quality, recording format, and current free-tier allowances before locking the provider or enabling metered services.

“Tomorrow morning” uses a configurable morning default, initially 9:00 am, in the user's time zone. Ambiguous phrases remain unset for review. Store absolute times in UTC and retain the time zone used to interpret human language. A phrase asking for a reminder does not create a due date.

### 5. Android and native clients

Build the Android experience after the Mac workflow and sync model are proven. Android can become the designated reminder device so a reminder does not alert on every device; an already scheduled alert must still fire without network access. Windows and native macOS clients can follow if browser limits justify them. iPhone support remains later. Any new client uses the same source capture and task semantics.

## Proposed implementation boundaries

| Part | Initial direction |
| --- | --- |
| Mac MVP | Web app with a simple, responsive desktop layout. Target host: `task.hanoryx.com`. |
| Local data | Persistent browser storage and local-first writes. Verify reload, restart, and offline behavior on the browsers used for the MVP. |
| Hosting | Existing domain; configure DNS and hosting only when the app is ready to deploy. |
| Sync, later | Supabase is a candidate for account auth, private Postgres rows, and live changes. Recheck service terms before implementation. |
| AI, later | Authenticated Cloudflare Worker for transcription and task extraction, with strict usage limits. Recheck model availability and costs before implementation. |
| Native, later | Android reminder client first; native Mac and Windows packages only if needed after daily use of the web app. |

The target is no additional monthly service charge for normal personal use, subject to current provider limits. Do not enable paid plans or metered providers without a deliberate decision. Never put a Supabase service-role key or Cloudflare API token in a browser or native bundle. Apply account-scoped database policies to every exposed table once hosted sync exists.

## Full-product acceptance checks

- A text capture takes one send action; voice takes hold, speak, release. Both save locally before processing.
- “Change the Cloudflare email tomorrow morning” yields a linked task draft and a 9:00 am local reminder proposal the next day, without inventing a due date.
- A message containing two actions yields two independently editable suggestions; a non-task message yields none.
- Transcription or extraction failure offers retry and manual edit without losing the source capture.
- Completing or snoozing a task updates online devices; reconnect fetches missed changes without duplicate tasks.
- The designated Android phone delivers an already scheduled reminder while offline.
- Reaching an AI usage limit does not block text capture, manual tasks, local reminders, or later retry.

## Product decision to test

Parsed tasks appear as visible drafts that can be corrected or dismissed. Keep the capture path fast and let daily use of the first working prototype guide any change to confirmation behavior.

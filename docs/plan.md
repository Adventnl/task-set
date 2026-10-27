# Task Set: product and build plan

Finance workflow revision (27 October 2026): Finance opens on a transaction register with saved browser filters and a 60-day initial period. Use the all-history inbox for classification, category-button modals with Save & next, interactive date charts, clear accounts and a private Excel/CSV report library. Budget controls are removed from the main UI. Reuse the authenticated Worker/SQLite path, expose actual errors and preserve bank facts. AI merchant context and receipt-photo matching remain separate from the user's categories and notes. See [Finance](finance.md) for calculation and live-verification limits.

Status: revised 28 September 2026. Phases 1–4 are implemented as one installable web app for Mac and phone, with live sync and explicitly requested task generation, plus a Calendar and Meetings (see [Calendar and meetings](#calendar-and-meetings)). `task.hanoryx.com` is the intended host name; deployment has not been completed.

## The problem

The current workaround is a private Discord group chat: send a message now and hope to find it later. A traditional task app adds too much work at the moment of capture. Task Set should feel like sending a message to yourself, while making the actionable parts easy to find and remember.

For example, at 11 pm, someone says, “Generate task: change the Cloudflare email tomorrow morning.” The capture appears immediately. When the note explicitly says “generate task,” extraction creates a linked task called “Change the Cloudflare email” and a reminder for 9:00 am tomorrow in the user's local time. The original words remain available, and the task and reminder can be corrected independently.

## Product rules

1. **Capture first.** A saved capture is never lost because AI or sync fails. Voice is turned into text as it is spoken and saved as text; audio is never stored (decision of 26 September 2026).
2. **The feed is the source.** Every capture remains in a chronological, searchable private feed. A capture may produce zero, one, or several tasks.
3. **Typed notes generate tasks only when asked; voice notes suggest them.** A typed note never calls AI unless it says “generate task” (also “generate a task” or “generate tasks”; negated commands do not count) or its menu's **Generate tasks** is chosen; both create tasks directly in Tasks. A voice note is read automatically and its suggestions wait under the note (and in Tasks) until confirmed with **Create task** or dismissed. The original note stays unchanged. A note’s adjacent ⋯ menu, long press, or right-click offers Copy, Generate tasks, Make task, and Delete. (Decision of 28 September 2026.) Never invent a deadline, delete a capture, or mark work complete.
4. **Reminder time is distinct from due time.** “Remind me tomorrow morning” sets a reminder, not a due date. “Due Friday” sets a due date.
5. **Works across devices eventually.** When sync arrives, captures and edits should reach signed-in devices within seconds while online. Local capture continues without a connection.
6. **One person first.** This is a personal workspace, not a group messenger.

## First build: Mac browser MVP

Build the first usable slice for a Mac browser, using the blank-canvas interface in [DESIGN.md](DESIGN.md). The web app can later be hosted at `task.hanoryx.com`. An installable browser app is a useful option after its offline loading and update behavior are tested. A native Mac package is not required to validate the first experience.

The first slice includes a chronological Feed, a one-action text composer, local persistence, and manual tasks linked to captures. A capture should show immediately and survive a reload or browser restart in the same browser profile. Task editing and completion should remain usable when the network is unavailable. Today, Inbox, and Upcoming should stay simple: Today holds overdue, due-today, or pinned tasks; Inbox holds tasks needing a date or review; Upcoming holds scheduled work. (Decision of 27 September 2026: these became one **Tasks** view beside the Feed: pinned first, then undated, then dated work soonest first.) A non-actionable note remains only a message. (Decision of 27 September 2026: the Feed is presented as **Notes**; completing a task moves it to an **Archive** that keeps it for 60 days.)

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

Implementation status (26 September 2026): the web app manifest, icons, and service worker are built; the installed app opens offline. The Worker is configured for the `task.hanoryx.com` custom domain but not deployed. Data export is not built.

Configure `task.hanoryx.com` on the existing domain, serve the app over HTTPS, and verify that the loaded app shell and local capture work when disconnected. Add data export before depending on a single local browser store. Add a manifest and installation support if the browser behavior is reliable. Do not describe the site as live until deployment and checks are complete.

### 3. Accounts and sync

Implementation status (26 September 2026): a single passcode signs a device in with a signed, HttpOnly session cookie. All devices share one Cloudflare Durable Object that stores captures and tasks in SQLite with a change sequence, and nudges devices over WebSockets to pull. Each browser keeps an IndexedDB copy and an outbox of unsent changes. The most recent task edit wins; capture text is immutable; deleting a capture deletes its tasks. This replaces the Supabase candidate below and needs no service outside Cloudflare.

Add sign-in, private account-scoped storage, a local write queue with stable IDs, initial sync, reconnect catch-up, and live updates. The original capture is immutable. For simple task fields, the latest server-accepted edit wins; an unsynced capture must never be silently discarded. A candidate hosted service is Supabase Auth, Postgres, and Realtime, subject to a prototype and current free-tier terms. The browser app should save locally first, then sync. Sign-in should be a requirement for cross-device data, not for opening a public landing page.

### 4. Voice and AI

Implementation status (26 September 2026): Hold-to-talk uses the browser's live speech recognition, so words appear while speaking and are sent as text on release. Browsers without it record into memory and send the audio once to Whisper with voice-activity filtering; the audio is discarded. Only captures explicitly requesting task generation are queued on the server for extraction by Llama 4 Scout, retried up to three times, and shown as editable tasks in Tasks. Earlier suggested drafts remain reviewable in Tasks. The model receives the local time and a 14-day calendar; its output must quote the capture, and code enforces the reminder/due rule, default times, and a plausible date range. Earlier recording storage, playback, download, and manual transcript editing were removed at the user's request.

The paragraphs below describe the original plan; where they mention stored recordings, the decision above replaces them.

Add hold-to-record capture, save the audio locally on release, then transcribe and extract task suggestions. Show saved, transcribing, extracting, ready, and needs-retry states. Until transcription succeeds, the recording remains on its originating device; other synced devices can show a placeholder. Keep the local audio until the transcript is safely stored and synced, then remove it by default unless the user chooses to keep it.

A Cloudflare Worker on the existing domain is the candidate AI endpoint. It should verify the signed-in user and enforce per-user upload and request limits before calling hosted transcription and text models. Model output must be validated, tied to the source capture, and processed idempotently so retries do not create duplicate tasks. If AI is unavailable or at its usage limit, the original capture remains available for retry or manual task creation. Confirm model quality, recording format, and current free-tier allowances before locking the provider or enabling metered services.

“Tomorrow morning” uses a configurable morning default, initially 9:00 am, in the user's time zone. Ambiguous phrases remain unset for review. Store absolute times in UTC and retain the time zone used to interpret human language. A phrase asking for a reminder does not create a due date.

### 5. Android and native clients

Implementation status (26 September 2026): phone capture uses the same web app, installed to the home screen, instead of a separate Android codebase. A native or packaged Android client remains the route to reliable offline reminder notifications.

Build the Android experience after the Mac workflow and sync model are proven. Android can become the designated reminder device so a reminder does not alert on every device; an already scheduled alert must still fire without network access. Windows and native macOS clients can follow if browser limits justify them. iPhone support remains later. Any new client uses the same source capture and task semantics.

## Calendar and meetings

Decision of 27 September 2026, from the owner's request: the app is four features, not three views. **Notes** and **Tasks** stay; the **Archive** becomes a tab of Tasks (Open and Archive), since it is the same list of work before and after it is done. Two features are added:

- **Calendar.** Ordinary calendars make a note on a day cost a form: start and end times, reminders, alarms, and a time zone. Here, choosing a day and typing or talking (the same composer and microphone as notes) puts an **event** on that day, and nothing else is asked. An event is only a local date and words. Days with events are tinted so they are obvious, and the home page (Notes) counts down to the next three: “Today”, “Tomorrow”, “In 4 days”. The calendar is site-wide: open tasks show on the day of their due date (or reminder, when there is no due date), and meetings show on every day they happen.
- **Meetings.** Not a meeting tool, but meeting notes. A meeting is a name, a day, an optional time, and whether it happens once or every week; weekly meetings appear on the calendar every week. Each meeting day has its own notes. A meeting opens on its next day, so its notes are the things to bring up next time; any other day can be opened to write or read notes for that meeting.

Implementation status (27 September 2026): built and checked end to end with a local Worker and two browsers. Events, meetings, and meeting notes are three new synced record types with the same local-first outbox, last-edit-wins merging, and final deletions as tasks. The server links each meeting note to its meeting, as it links each task to its capture, so deleting a parent deletes its children on every device, and a child written offline for a parent deleted elsewhere is deleted too. Days and times are plain local values (`YYYY-MM-DD`, `HH:mm`), so they never move with daylight saving or travel. Meeting notes are not sent to AI. Notifications for events and meetings are not sent yet, like task reminders.

## Proposed implementation boundaries

| Part | Initial direction |
| --- | --- |
| Mac and phone | One installable web app with desktop and phone layouts. Target host: `task.hanoryx.com`. |
| Local data | Persistent browser storage and local-first writes. Verify reload, restart, and offline behavior on the browsers used for the MVP. |
| Hosting | Existing domain; configure DNS and hosting only when the app is ready to deploy. |
| Sync | Passcode session plus one Cloudflare Durable Object (SQLite and hibernating WebSockets) behind the same Worker. |
| AI | Workers AI from the Worker: Llama 4 Scout for suggestions, Whisper for fallback transcription. Rate-limited; no AI API key. |
| Native, later | Android reminder client first; native Mac and Windows packages only if needed after daily use of the web app. |

The target is no additional monthly service charge for normal personal use, subject to current provider limits. Do not enable paid plans or metered providers without a deliberate decision. Never put a Supabase service-role key or Cloudflare API token in a browser or native bundle. Apply account-scoped database policies to every exposed table once hosted sync exists.

## Full-product acceptance checks

- A text capture takes one send action; voice takes hold, speak, release. Both save locally before processing.
- “Generate task: change the Cloudflare email tomorrow morning” yields a linked task and a 9:00 am local reminder proposal the next day, without inventing a due date.
- An explicit generate-task message containing two actions yields two independently editable tasks; all other messages stay notes.
- Transcription or extraction failure offers retry and manual edit without losing the source capture.
- Completing or snoozing a task updates online devices; reconnect fetches missed changes without duplicate tasks.
- The designated Android phone delivers an already scheduled reminder while offline.
- Reaching an AI usage limit does not block text capture, manual tasks, local reminders, or later retry.
- Choosing a calendar day and typing or saying a few words puts them on that day with no other fields; the day is visibly marked, and Notes counts down to it.
- A weekly meeting appears on the calendar every week; notes written in it belong to its next meeting day, and every other day's notes stay findable.

## Product decision to test

Explicitly requested tasks appear in Tasks and can be edited or deleted. Notes remain plain text. Keep the capture path fast and let daily use of the first working prototype guide any change to confirmation behavior.

## GitHub connector

Decision of 27 September 2026: add a GitHub view for monitoring open PRs and branches ahead across selected repositories, with Select all. PR rows show drafts, merge blockers, and checks; branches compare with their default branch and show ahead/behind counts. Repository access comes from a personal access token saved with a single account binding in this browser, never synced or sent to Task Set. Reloading restores the binding automatically. There is no account-switch or disconnect flow; expired or revoked tokens can be renewed only for the bound account. Repository choices are remembered on this device. Account verification and initial repository discovery happen once during binding or token renewal. Activity Refresh uses the saved repository list; Reload repositories explicitly discovers newly accessible repositories and remembers the updated list. Activity refreshes every minute while the view is visible, and failures are shown as incomplete results. Results arrive progressively, with two repositories and up to four detail/comparison operations per repository in flight. Each request times out after 15 seconds; a refresh has a 90-second budget and preserves loaded results on timeout. The Merge on GitHub action opens the PR at its merge section so the user reviews and confirms on GitHub. Direct merging inside Task Set and OAuth are not implemented.

## Keep screen on

Decision of 28 September 2026: Settings has an **Always on** switch remembered on this device. It requests a screen wake lock while Task Set is visible, releases it in the background or when turned off/signed out, and reacquires it on return. Unsupported browsers, denied requests, and device power-saving releases are stated in Settings.


## Owner workflow revision ? 14 October 2026

This decision supersedes the earlier shared-composer and per-device GitHub binding descriptions. Each section owns its capture: Notes creates notes; Tasks (including Archive) creates standalone tasks without a source capture; Calendar creates dated events; the Meetings list creates one-off meetings, and an open meeting creates only that day's meeting notes. Drafts stay separate by section/calendar day/meeting day. Tasks can have up to five optional comma-separated tags. Open and Archive retain completion, restore and Undo.

Calendar has independent month and year controls. Quick calendar recognises English date phrases locally using Chrono's British English parser (NZ day-first dates); missing years point forward from today, explicit years are respected, and undated words use the selected day. The saved date opens immediately. Date ranges or multiple dates require one entry at a time. This is deterministic date parsing, not a general-purpose AI agent. Birthday entries repeat yearly; the editor can mark a birthday or yearly event explicitly. Leap-day birthdays retain 29 February.

National NZ public holidays, actual and observed weekdays, and common observances appear automatically. Regional anniversary days use a remembered manual region or an explicit browser location request, with an editable override because anniversary areas do not always follow administrative boundaries. Precise location is used transiently for reverse geocoding and is not stored. Holiday references: [NZ Government dates](https://www.govt.nz/browse/work-and-tax/public-holidays-and-work/dates-for-public-holidays-and-anniversary-days/) and [published Matariki schedule](https://www.beehive.govt.nz/release/matariki-holiday-dates-next-thirty-years-announced). The published Matariki schedule ends in 2052; dates beyond it are not guessed.

Meetings default to Once with no time required. All meetings and Previous meetings are separate tabs; Previous includes the most recent past occurrence of a recurring meeting and opens its past notes. Older occurrences remain available inside the meeting. Delete is available directly beside a scheduled meeting, as well as in its editor.

GitHub belongs to Adventnl. Signed-in clients access read-only GitHub resources through the Worker; the Worker verifies its secret token's account against the shared owner configuration in src/shared/config/owner.ts. Browser account-binding/token forms are gone. Cached repository choices and activity restore immediately. As revised on 22 October 2026, saved activity stays until the owner presses Refresh; reopening the section or app, tab visibility, connection recovery and time passing do not trigger GitHub scans. A selection without a saved snapshot loads once. Explicit refreshes revalidate lists with ETags and reuse comparisons cached by immutable base/head commit SHA. Closed PRs and removed branches leave the next completed snapshot. Repository discovery runs initially and when the owner presses Reload repositories; it has no background timer. Configure GITHUB_TOKEN with `npx wrangler secret put GITHUB_TOKEN` using Adventnl's read token for Contents, Pull requests, Checks and Commit statuses. Never commit this token or place it in VITE_ variables. Existing passcode sessions continue to protect every data/GitHub API; public app assets contain no GitHub credentials. A token is not configured or deployed by this change.

Map uses real Google Maps; Leaflet and OSM tiles were removed on 15 October 2026. Without a Google Maps key, it uses Google's standard iframe with Photon place search: save a search result to a named colour category (e.g. red Restaurants), and select a saved place to show it on Google Maps. This mode shows one saved location at a time; iframe clicks cannot add app pins. With `VITE_GOOGLE_MAPS_API_KEY`, the Maps JavaScript API renders all filtered category pins and supports picking Google's named places or any point; search uses Places API (New). `VITE_GOOGLE_MAPS_MAP_ID` supplies a production JavaScript map ID (otherwise Google's demo ID is used). Restrict the browser key by HTTP referrer and APIs, configure it in build variables, and rebuild; no GitHub secrets belong in the browser build. Categories and pins retain the existing IndexedDB/outbox/Worker sync and cascading deletion. Saved places remain available locally; the map and search need a connection. Sources: [Google Maps loading](https://developers.google.com/maps/documentation/javascript/load-maps-js-api), [advanced markers](https://developers.google.com/maps/documentation/javascript/advanced-markers/start), and [Photon](https://github.com/komoot/photon). `VITE_GEOCODER_URL` can still override Photon for keyless search and NZ reverse geocoding; update the CSP allowlist for a different host.

At widths up to 760 px, six sections appear in a bottom navigation bar with selective translucent glass, readable labels, touch targets and safe-area spacing. The header menu remains for Settings/install access. Wide layouts retain the sidebar. Note actions float independently of scroll content, choose the available upward/downward space, and open with Shift while hovering, a click, right-click or long press.

## Lists and navigation update — 22 October 2026

**Lists** holds named checklists for dinner guests, shopping, and similar collections. Create the name first; the new list then opens for individual entry or **Import items**, where each nonblank line becomes one item. Import trims surrounding whitespace and preserves order and duplicates. Items can be checked and unchecked in place, removed individually, and searched; the list index searches both names and item text and shows checked/total counts. Lists can be renamed or deleted after confirmation that includes their items.

Lists save locally and use the existing outbox and live sync. Deleting a list also deletes its items across devices. Individual-entry and import drafts remain separate per list while navigating; failed saves retain their input. Opening a list or returning to the index resets the scroll position. Lists uses its own controls rather than the note/voice composer.

This navigation decision supersedes the six-section bar above: primary navigation is **Notes, Lists, Calendar, GitHub, Meetings**, in that order on desktop and phone. **Tasks** and **Map** remain available through **More** in the desktop sidebar and through the phone's menu drawer. Settings and installation remain in the menu.

## Authentication and navigation revision — 22 October 2026

The desktop sidebar and phone menu drawer show **Notes, Calendar, GitHub, Lists, Tasks, Maps, Meetings**, in that order, with no More disclosure. The phone bottom bar remains compact: Notes, Calendar, GitHub, Lists, Meetings; Tasks and Maps are available in its menu.

The Worker authenticates every app document and bundle request before serving assets. Signed-out visitors see a separate native passcode form and load only its styling, update script and public install/brand resources. A second browser session check runs before importing/mounting the private workspace or reading IndexedDB. Missing configuration, invalid sessions and verification failures keep the workspace locked. The old offline shell cache is removed; opening/reloading requires a server connection. Already-open authenticated workspaces still save locally during connection loss. Signing out removes local workspace/GitHub caches and signals other open tabs to lock. Existing signed session cookies remain valid until expiry or secret/passcode rotation.

GitHub uses the existing authenticated, read-only Worker proxy and needs Adventnl's read-only `GITHUB_TOKEN` Worker secret. Initial production secret-name inspection on this date confirmed it was absent. The owner subsequently added it; its presence was confirmed and the navigation/private-entry changes were deployed. Live verification after owner sign-in connected as Adventnl and scanned all 27 accessible repositories without warnings (7 ahead branches, no open PRs). Check-run and combined-status reads also succeeded on a sampled repository; no live PR merge/check state was available. The Worker uses manual redirect handling and refuses redirects so its credential is never forwarded. No secret values were read. README contains permissions, scope, renewal and configuration steps.


## AI News ? 27 October 2026

AI News is a sidebar section, also accessible from the phone navigation drawer. It collects model releases, AI apps/tools, funding and industry stories from Google News search RSS, TechCrunch AI, OpenAI and Hugging Face. The shared Worker digest refreshes around 7:05 am Pacific/Auckland, with daylight saving handled by the local-time daily boundary, and catches up on opening the page. Refresh news is available with a five-minute collection cooldown. No paid search provider or additional credentials are required.

Stories retain publisher, publication time, source links, and source-provided descriptions where available. Funding amounts remain as reported in headlines/descriptions; they are not independently verified. Search feeds often supply headlines only. Company descriptions, direct startup websites, exhaustive internet coverage and generated research summaries are not guaranteed. The seven-day digest deduplicates headlines/URLs and retains recent stories from temporarily failed sources with explicit warnings. This is AI-topic news aggregation, not a claim that a model independently researched every story.


### Finance workflow refinement - 27 October 2026

Finance enters the paginated transaction register. Save browser-specific filters with a rolling 60-day initial period and a separate all-history review inbox. User-created SQLite categories are chosen as buttons in a modal; optional notes and merchant rules save alongside them, and Save & next queries the remaining review queue. Remove budget UI and monthly cash-flow clutter. Use Recharts for tooltips, date drill-down and range selection, and filter account observations to the chosen period. Retain generated report binaries in the private database and provide a saved report library with Excel sheet previews. Receipt photos propose exact-amount/currency/date-window matches for confirmation; PDFs retain manual attachment. AI merchant context is separate from bookkeeping and abstains on uncertainty. Cached Akahu checks run at most every five minutes while Finance is visible; forced bank refresh remains provider-limited and explicit.

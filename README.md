# Task Set

Task Set is a private notes app that finds your tasks. Type a thought or hold the microphone and say it; it lands in Notes on a blank page. AI reads each note and suggests tasks with any times you mentioned, and **Create task** turns a suggestion into a real task. A calendar takes a day's plans without a form, and meetings keep notes for next time. Your phone and computer stay in sync live.

The app is built to run at `task.hanoryx.com` on Cloudflare. It has not been deployed yet; see [Deploy](#deploy).

- [Product and build plan](docs/plan.md)
- [Design direction](docs/DESIGN.md)
- [Engineering rules for AI and human changes](docs/engineering-rules.md)

## How it works

- **Capture.** Enter sends; Shift+Enter adds a line. Every note is saved on the device first, so it is never lost to a bad connection. Notes written offline show *Not synced yet* and send themselves when the connection returns.
- **Voice.** Hold the microphone, talk, and let go to send. A quick tap starts hands-free listening; tap the square to send or × to cancel. Speech becomes text on the spot using the browser's speech recognition, so no recording is ever stored or offered for download. Browsers without live recognition (for example Firefox) record into memory, send the audio once for transcription, and discard it.
- **AI suggestions.** The server looks at every new note automatically and proposes zero to five tasks. A plain time ("tomorrow morning") becomes a reminder; only deadline words ("by Friday", "before", "due") set a due date. Times that the note does not actually contain are thrown away. Suggestions stay drafts until you create, edit, or dismiss them. If the AI fails three times, the note shows *Try again*.
- **Four sections.** Notes, Tasks, Calendar, and Meetings. The composer at the bottom works everywhere and says where your words will go: a new note, a calendar day, or a meeting.
- **Tasks.** The **Open** tab lists open tasks: pinned first, then tasks without a date (newest first), then dated tasks (soonest first). A task's date is its due date, or its reminder if it has none; notifications are not sent yet. The pin on a task row, or **Pin to the top of Tasks** in the editor, keeps it on top.
- **Completing and the Archive.** Ticking a task completes it and moves it off its note into the **Archive** tab of Tasks, with **Undo** offered for a few seconds. The Archive lists completed tasks newest first with the days left; **Restore** puts one back in Open, and the bin deletes it at once. Sixty days after completion a task is deleted for good, on every device.
- **Calendar.** Choose a day, then type or hold the microphone and say what is happening; it goes on that day. No times, reminders, or time zones to fill in. On a computer, clicking a day puts the cursor in the box, so you can click and type. Days with something on them are tinted, and the top of Notes counts down to the next three (“In 4 days”). Open tasks show on their date, and meetings show on every day they happen. Tap an entry to correct it or move it to another day. Arrow keys move around the month.
- **Meetings.** Add a meeting with a name, a day, an optional time, and **Every week** or **Once**. It appears on the calendar, and opens on its next meeting: whatever you type or say is added to that day's notes, ready to bring up. The arrows step through other weeks, and past days keep what was written. Deleting a meeting deletes its notes, on every device.
- **Select and delete.** The select button in the Notes header puts a circle beside every note. Tick several (or **Select all**, which respects a search) and delete them together; tasks made from them go too. Escape or × stops selecting.
- **Appearance.** Open Settings (the gear beside the sync status) and choose System, Light, or Dark. The choice is kept on that device only.
- **Sync.** Signed-in devices share one private workspace. Changes appear on the other devices within about a second. When two devices edit the same task, the most recent edit wins. Deleting a note also deletes the tasks made from it.
- **Install as an app.** In Chrome or Edge on a computer or Android phone, choose **Install app** in the sidebar or in Settings (or the install icon in the address bar). On iPhone, use Safari's **Share → Add to Home Screen**; on a Mac, Safari's **File → Add to Dock**. The installed app opens in its own window, opens without a connection, and syncs when it can. Settings says when it is already installed.

Keyboard: ⌘K (Ctrl+K) searches notes and their tasks, N focuses the composer, arrow keys move around the calendar month and between the Tasks tabs, and Escape closes search or a dialog.

## Deploy

Everything runs on one Cloudflare Worker: the static app, the API, a Durable Object that stores the workspace and pushes live updates, and Workers AI (Llama 4 Scout for task suggestions, Whisper for the fallback transcription). Workers AI is billed to the Cloudflare account, and normal personal use fits within its free daily allocation, which resets at 00:00 UTC. When that allocation is used up, task suggestions fail for the day and each note shows *Try again*. An [OpenRouter](https://openrouter.ai) fallback is built in but **turned off**: it runs only when the optional `OPENROUTER_API_KEY` secret is set, and then the same Llama 4 Scout model answers on OpenRouter, billed to your OpenRouter credits. Voice transcription has no fallback. Check current [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) before relying on the free allocation.

[`wrangler.jsonc`](wrangler.jsonc) pins `account_id` to the Hanoryx Systems account, which owns the `hanoryx.com` zone, so the Cloudflare login you deploy with must have access to that account. The route in [`wrangler.jsonc`](wrangler.jsonc) creates the `task.hanoryx.com` DNS record and certificate automatically.

```sh
npm install
npx wrangler login          # the Cloudflare account that owns hanoryx.com
npm run deploy:first        # asks for a passcode, generates the session secret, deploys
```

Later deploys: `npm run deploy`. It runs the full validation first.

To change the passcode, run `npx wrangler secret put APP_PASSCODE`; every device is signed out and signs in with the new one. The passcode must be at least 12 characters, so use a phrase. Sign-in attempts are limited to five per minute per network address. To turn the OpenRouter fallback on, run `npx wrangler secret put OPENROUTER_API_KEY`; to turn it off again, run `npx wrangler secret delete OPENROUTER_API_KEY`. Setting a credit limit on the key in OpenRouter caps what the fallback can spend.

## Security model

- One person, one passcode. Signing in sets an HttpOnly, Secure, SameSite=Strict cookie that is valid for 400 days and is signed with `SESSION_SECRET`. The passcode is part of the signature, so changing it ends every session.
- Every API route checks the session. Writes and the live socket also require a same-origin request.
- Notes, tasks, calendar events, meetings, and meeting notes are stored in a Durable Object in your Cloudflare account and in each signed-in browser's IndexedDB. Signing out removes the browser copy.
- Note text is sent to Workers AI for task suggestions. It goes to OpenRouter, and the provider it routes to, only when the fallback key is set and Workers AI fails.
- Audio is never stored. The fallback transcription audio exists only for the length of one request.
- The static app is served with a strict Content Security Policy and microphone access limited to this site.

## Develop

```sh
npm install
printf 'APP_PASSCODE="local dev passcode"\nSESSION_SECRET="%s"\n' "$(openssl rand -hex 32)" > .dev.vars
npm run build && npm run worker:dev    # API, Durable Object, and built app on http://127.0.0.1:8787
npm run dev                            # in a second terminal: hot-reloading UI that proxies /api to the Worker
```

`.dev.vars` is ignored by git. The AI binding always calls Cloudflare's hosted models, even in local development, so AI requests use the logged-in account's allocation. Add `OPENROUTER_API_KEY` to `.dev.vars` only to exercise the fallback locally; without it, a failed Workers AI call simply fails. Without the Worker running, `npm run dev` still works as a local-only app and shows *Offline*.

Run `npm run validate` before committing. It checks source layout and imports, type-checks the browser app and the Worker, runs the tests, and builds. For Worker or Wrangler changes, also run `npm run worker:dry-run`.

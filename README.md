# Task Set

Task Set is a private, message-first task app. Type a thought or hold the microphone and say it; it lands in your Feed like a message to yourself. AI reads each message and suggests tasks with any times you mentioned, and **Create task** turns a suggestion into a real task. Your phone and computer stay in sync live.

The app is built to run at `task.hanoryx.com` on Cloudflare. It has not been deployed yet; see [Deploy](#deploy).

- [Product and build plan](docs/plan.md)
- [Design direction](docs/DESIGN.md)
- [Engineering rules for AI and human changes](docs/engineering-rules.md)

## How it works

- **Capture.** Enter sends; Shift+Enter adds a line. Every message is saved on the device first, so it is never lost to a bad connection. Messages written offline show *Not synced yet* and send themselves when the connection returns.
- **Voice.** Hold the microphone, talk, and let go to send. A quick tap starts hands-free listening; tap the square to send or × to cancel. Speech becomes text on the spot using the browser's speech recognition, so no recording is ever stored or offered for download. Browsers without live recognition (for example Firefox) record into memory, send the audio once for transcription, and discard it.
- **AI suggestions.** The server looks at every new message automatically and proposes zero to five tasks. A plain time ("tomorrow morning") becomes a reminder; only deadline words ("by Friday", "before", "due") set a due date. Times that the message does not actually contain are thrown away. Suggestions stay drafts until you create, edit, or dismiss them. If the AI fails three times, the message shows *Try again*.
- **Feed and Tasks.** There are two tabs. Tasks lists pinned tasks first, then tasks without a date (newest first), then dated tasks (soonest first), then what you finished today. A task's date is its due date, or its reminder if it has none; notifications are not sent yet. The pin on a task row, or **Pin to the top of Tasks** in the editor, keeps it on top.
- **Select and delete.** The select button in the Feed header puts a circle beside every message. Tick several (or **Select all**, which respects a search) and delete them together; tasks made from them go too. Escape or × stops selecting.
- **Appearance.** Open Settings (the gear beside the sync status) and choose System, Light, or Dark. The choice is kept on that device only.
- **Sync.** Signed-in devices share one private workspace. Changes appear on the other devices within about a second. When two devices edit the same task, the most recent edit wins. Deleting a message also deletes the tasks made from it.
- **Install on a phone.** Open the site in Chrome on Android and choose **Add to Home screen** (or **Install app**). On iPhone, use Safari's **Share → Add to Home Screen**. The installed app opens without a connection and syncs when it can.

Keyboard: ⌘K (Ctrl+K) searches messages and tasks, N focuses the message box, and Escape closes search or a dialog.

## Deploy

Everything runs on one Cloudflare Worker: the static app, the API, a Durable Object that stores the workspace and pushes live updates, and Workers AI (Llama 4 Scout for task suggestions, Whisper for the fallback transcription). Workers AI is billed to the Cloudflare account, and normal personal use fits within its free daily allocation, which resets at 00:00 UTC. When a Workers AI call for task suggestions fails, for example because that allocation is used up, the same Llama 4 Scout model runs on [OpenRouter](https://openrouter.ai) with your API key and is billed to your OpenRouter credits. Voice transcription has no fallback. Check current [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) and OpenRouter prices before relying on that.

[`wrangler.jsonc`](wrangler.jsonc) pins `account_id` to the Hanoryx Systems account, which owns the `hanoryx.com` zone, so the Cloudflare login you deploy with must have access to that account. The route in [`wrangler.jsonc`](wrangler.jsonc) creates the `task.hanoryx.com` DNS record and certificate automatically.

```sh
npm install
npx wrangler login          # the Cloudflare account that owns hanoryx.com
npm run deploy:first        # asks for a passcode and OpenRouter API key, generates the session secret, deploys
```

Later deploys: `npm run deploy`. It runs the full validation first.

To change the passcode, run `npx wrangler secret put APP_PASSCODE`; every device is signed out and signs in with the new one. The passcode must be at least 12 characters, so use a phrase. Sign-in attempts are limited to five per minute per network address. To change the OpenRouter key, run `npx wrangler secret put OPENROUTER_API_KEY`. Setting a credit limit on the key in OpenRouter caps what the fallback can spend.

## Security model

- One person, one passcode. Signing in sets an HttpOnly, Secure, SameSite=Strict cookie that is valid for 400 days and is signed with `SESSION_SECRET`. The passcode is part of the signature, so changing it ends every session.
- Every API route checks the session. Writes and the live socket also require a same-origin request.
- Messages and tasks are stored in a Durable Object in your Cloudflare account and in each signed-in browser's IndexedDB. Signing out removes the browser copy.
- Message text is sent to Workers AI for task suggestions, and to OpenRouter and the provider it routes to only when Workers AI fails.
- Audio is never stored. The fallback transcription audio exists only for the length of one request.
- The static app is served with a strict Content Security Policy and microphone access limited to this site.

## Develop

```sh
npm install
printf 'APP_PASSCODE="local dev passcode"\nSESSION_SECRET="%s"\nOPENROUTER_API_KEY=""\n' "$(openssl rand -hex 32)" > .dev.vars
npm run build && npm run worker:dev    # API, Durable Object, and built app on http://127.0.0.1:8787
npm run dev                            # in a second terminal: hot-reloading UI that proxies /api to the Worker
```

`.dev.vars` is ignored by git. The AI binding always calls Cloudflare's hosted models, even in local development, so AI requests use the logged-in account's allocation. Put your OpenRouter key in `.dev.vars` only to exercise the fallback locally; left empty, a failed Workers AI call simply fails. Without the Worker running, `npm run dev` still works as a local-only app and shows *Offline*.

Run `npm run validate` before committing. It checks source layout and imports, type-checks the browser app and the Worker, runs the tests, and builds. For Worker or Wrangler changes, also run `npm run worker:dry-run`.

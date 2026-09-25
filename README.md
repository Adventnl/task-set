# Task Set

Task Set is a private, message-first task app for capturing a thought as quickly as sending yourself a message. The current browser build has a chronological Feed, locally saved text and voice captures, manual tasks, and optional AI transcription and task suggestions.

The intended hosted address is `task.hanoryx.com`; the site has not been deployed. An installable browser app is possible after offline behavior is verified. Android reminders, native clients, and account sync are later phases.

- [Product and build plan](docs/plan.md)
- [Mac-first design direction](docs/DESIGN.md)
- [Engineering rules for AI and human changes](docs/engineering-rules.md)

The core rule is local-first capture: a saved note or recording stays available even when a network or AI step fails. The original capture remains in the Feed while tasks can be edited independently. This build does not sync between devices; browser site data should be exported or synced before it is treated as a long-term archive.

## Run the Mac browser build

```sh
npm install
npm run dev
```

Open the local address Vite prints. `npm run build` checks TypeScript and creates a production build in `dist/`.

Write a thought and press Enter to save it; Shift+Enter adds a line. Use **Add task** below any capture to create a linked task. Tasks can be edited, pinned to Today, given a due date, completed, reopened, and removed without changing the original capture. Use ⌘N to focus the composer and ⌘K to search the Feed.

Hold the microphone button, speak, and release to save a voice capture. Play or download the original recording from the Feed. Browsers usually record WebM or M4A; files are downloaded in their actual format, without MP3 conversion. Transcripts can be written or edited manually. **Transcribe** and **Suggest tasks** send the selected recording or text to the configured AI Worker only when clicked. Suggestions remain drafts until accepted; they can be edited or dismissed.

Captures, recordings, transcripts, and tasks are stored in IndexedDB in the current browser profile. The app works without a network once its page is loaded. Offline page loading, data export, sync, and reminder notifications are not implemented. Saving a reminder time does not schedule an alert.

## AI Worker

The Worker source and bindings are in [`worker/`](worker/) and [`wrangler.jsonc`](wrangler.jsonc). It uses Cloudflare Access JWT verification, a per-user rate limit of six requests per minute per AI route, an 8 MiB audio limit, [Whisper large v3 turbo](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/) for transcription, and [Llama 3.3 70B](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/) for structured suggestions. Audio and task records remain in IndexedDB; the Worker does not store them. AI model usage can be billed by Cloudflare. No Worker has been deployed by this change.

Before deploying, protect the site with a Cloudflare Access application and set `ACCESS_TEAM_DOMAIN` (for example, `https://your-team.cloudflareaccess.com`) and `ACCESS_AUD` as Worker secrets using `npx wrangler secret put`. The Worker validates the Access JWT itself and rejects AI requests without it. Verify the account, domain, Access policy, model usage budget, and microphone formats on the actual browsers before enabling the hosted endpoint. `npm run worker:dry-run` validates the bundle without deploying.

Run `npm run validate` for source layout and import guardrails, browser and Worker TypeScript checks, logic tests, and the production build.

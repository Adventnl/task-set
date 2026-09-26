# Build status

## ▶ Resume here

26 September 2026: Task Set is a complete installable web app for Mac and phone. It has live speech-to-text capture (no audio stored), automatic AI task suggestions on the server, passcode sign-in, real-time sync through a Durable Object, an offline-first IndexedDB outbox, and a full redesign that follows `docs/DESIGN.md` in light and dark appearances. `npm run validate` and `npm run worker:dry-run` pass. A local end-to-end run with `wrangler dev`, Workers AI, and Chrome covered desktop and phone layouts, live sync, voice capture (a scripted speech engine plus the recording fallback), offline sending, and offline reload.

27 September 2026: task suggestions fall back to Llama 4 Scout on OpenRouter when a Workers AI call fails, for example after the daily free allocation. `OPENROUTER_API_KEY` is a required secret, and `npm run deploy:first` asks for it.

27 September 2026: the views are now Feed and Tasks. Tasks lists Pinned, No date (newest first), Scheduled (soonest first), and Done today, with a pin toggle on every row. The Feed can select several messages and delete them, with their tasks, in one local save. Settings (opened from the sync status) adds a per-device System, Light, or Dark appearance; every color token is a single `light-dark()` pair. Checked in headless Chrome at 1280, 390, and 320 px in both appearances.

Next:

1. Deploy from the Cloudflare account that owns `hanoryx.com`: `npx wrangler login`, then `npm run deploy:first` (have an OpenRouter API key ready).
2. Try voice on the real phone and Mac browsers; headless tests cannot use a real microphone.
3. Add reminder notifications (Web Push or a packaged Android client) and data export.

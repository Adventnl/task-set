# Build status

## ▶ Resume here

26 September 2026: Task Set is a complete installable web app for Mac and phone. It has live speech-to-text capture (no audio stored), automatic AI task suggestions on the server, passcode sign-in, real-time sync through a Durable Object, an offline-first IndexedDB outbox, and a full redesign that follows `docs/DESIGN.md` in light and dark appearances. `npm run validate` and `npm run worker:dry-run` pass. A local end-to-end run with `wrangler dev`, Workers AI, and Chrome covered desktop and phone layouts, live sync, voice capture (a scripted speech engine plus the recording fallback), offline sending, and offline reload.

Next:

1. Deploy from the Cloudflare account that owns `hanoryx.com`: `npx wrangler login`, then `npm run deploy:first`.
2. Try voice on the real phone and Mac browsers; headless tests cannot use a real microphone.
3. Add reminder notifications (Web Push or a packaged Android client) and data export.

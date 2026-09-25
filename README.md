# Task Set

Task Set is a private, message-first task app for capturing a thought as quickly as sending yourself a message. The first build is for a Mac browser, with a quiet blank-canvas interface, a chronological Feed, locally saved text captures, and manual tasks linked to those captures.

The intended hosted address is `task.hanoryx.com`; the site has not been deployed. An installable browser app is possible after offline behavior is verified. Android reminders, native clients, account sync, voice capture, and AI task suggestions are later phases.

- [Product and build plan](docs/plan.md)
- [Mac-first design direction](docs/DESIGN.md)

The core rule is local-first capture: a saved note stays available even when a network or later AI step fails. The original capture remains in the Feed while tasks can be edited independently. This first local browser slice does not yet sync between devices; browser site data should be exported or synced before it is treated as a long-term archive.

## Run the Mac browser build

```sh
npm install
npm run dev
```

Open the local address Vite prints. `npm run build` checks TypeScript and creates a production build in `dist/`.

Write a thought and press Enter to save it; Shift+Enter adds a line. Use **Add task** below any capture to create a linked task. Tasks can be edited, pinned to Today, given a due date, completed, reopened, and removed without changing the original capture. Use ⌘N to focus the composer and ⌘K to search the Feed.

Captures and tasks are stored in IndexedDB in the current browser profile. The app works without a network once its page is loaded, but offline page loading, data export, sync, reminders, voice capture, and AI suggestions are later phases.

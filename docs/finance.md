# Finance integration

Finance extends the existing React/Vite workspace and its authenticated Cloudflare Worker. Exactly one `Finances` entry is added to the existing sidebar; its eight views share the existing shell and design tokens. Finance does not call Workers AI, OpenRouter or any other AI service.

## Run locally

Use Node 24 and the existing checkout; each cloud task is already isolated. Do not create a worktree for setup.

```sh
npm ci --cache /tmp/task-set-npm-cache
npm run validate
XDG_CONFIG_HOME=/tmp/task-set-config WRANGLER_SEND_METRICS=false npm run worker:dry-run
npm run worker:local
```

`worker:local` creates an ignored `.wrangler/local-dev.json` with the hosted AI binding omitted. It preserves `.dev.vars`; if absent it creates cryptographically random development authentication values without printing them. Sign in with the passcode in that local file, viewed privately. Existing AI features need a separately configured hosted development environment; the local command does not alter production bindings. `npm run dev` optionally adds hot reload through the existing API proxy. Never expose a loopback development server publicly.

Finance opens without bank secrets and shows an honest setup state. Tests use isolated SQLite databases and mocked Akahu responses. No production fixture data is inserted.

## Connect Akahu in production

Set these as **Worker secrets**, separately for production and Preview if needed:

```sh
npx wrangler secret put AKAHU_APP_TOKEN
npx wrangler secret put AKAHU_USER_TOKEN
```

Use the existing Akahu Personal App tokens, not an OAuth client secret. Never use `VITE_` variables, browser storage, chat or committed configuration for credentials. For local banking checks, add these names to the ignored `.dev.vars` privately. Onboarding proxy-secret bindings apply to the cloud machine, not automatically to the deployed Cloudflare Worker.

Akahu requests go only from the trusted backend to `https://api.akahu.io/v1`, with the user token as Bearer authorization and the app token as `X-Akahu-Id`. Redirects are refused. Only read endpoints and the documented `POST /refresh` are permitted; no payment initiation exists. Endpoint shapes and pagination were checked against Akahu's official SDK at commit `f7dc54af8b35258712b00cbb9ae17cce08e85e1c`; direct documentation access was blocked in this cloud instance. Confirm Personal App permissions against the current [Personal Apps documentation](https://developers.akahu.nz/docs/personal-apps) before using live data.

On the first Finance visit with configured credentials and no completed import, the browser attempts one initial sync. **Sync accounts** explicitly retries or updates imported data. This verifies `/me`, imports accessible accounts and every transaction page in the available 730-day window, then pending transactions. Initial imports do not generate transaction notifications, including retry after a partial initial failure. Akahu/bank availability may provide less history. Previously stored history never ages out of the local database. Configured credentials alone are not proof of a working connection. A failed sync is shown on the dashboard, with a fixed endpoint name and status/response-format diagnostic; upstream response bodies, tokens and pagination values are never displayed.

## Dashboard

Finance uses the available workspace width on desktop and a single scrolling column on phones. Underline navigation retains all eight sections. The overview combines current/available balances, money in/out and net cash flow with recorded daily spending, account summaries, transaction details, category drill-downs and current budget usage. Preset periods include the current month, 7/30/90/180/365 days, year to date and all retained history; Custom dates reveals date inputs. Boundaries use Auckland calendar dates. Charts describe recorded transactions, not verified complete bank coverage, and daily amounts remain available as text.

Transactions use search/account/category controls with other filters behind More filters. Review Inbox defaults to needs-review across retained history; choosing All states removes that restriction. Returning to Overview or Analytics clears transaction-specific filters while retaining dates. Reports retain the transaction selection. Header search remains in Finance and opens matching transactions. Exports and account/transaction actions use the existing authenticated APIs; there are no invented dashboard records.

Rotate rejected or exposed credentials in Akahu and replace the same Worker secret. Changing banking tokens does not require changing the app's passcode. Cloudflare's normal shared egress is not a verified static IP: no Akahu IP restriction was invented. Only enable such a restriction after confirming a stable outbound IP for the actual deployment.

## Storage and calculations

The existing `TaskSpace` Durable Object owns versioned, additive `CREATE TABLE IF NOT EXISTS` finance tables alongside the existing workspace tables. Parameterised SQLite statements, foreign keys, stable provider IDs, date/account/status indexes and atomic bookkeeping writes protect the dataset. Original and latest raw transaction payloads are retained separately from user categories, notes, tags, review state and splits. Important manual edits are audited.

Balances retain current and available values independently, source refresh timestamps and observation timestamps. Observed points and bank-supplied transaction balances are labelled; no historical or intraday balances are invented. The account view shows the latest 2,000 observations across accounts; the balance-history report queries all retained observations.

Amounts enter integer cent arithmetic before aggregation. Consolidated analytics use **NZD settled transactions only**, exclude confirmed transfers and exclusions, and subtract matched refunds from expenses. Non-NZD transactions remain visible and exportable in their original currency; there is no currency conversion. Splits must have the parent's sign and reconcile exactly. For a refund of a split purchase, explicitly allocate its category/splits; no allocation is guessed. Multiple partial refunds cannot exceed the original purchase. Credits are receipts, not assertions of taxable income.

Transaction dates use Pacific/Auckland calendar boundaries. First detected, last observed, provider update, balance refresh and notification creation dates remain distinct. Excel date cells are actual spreadsheet dates labelled UTC. Overview's month comparison is explicitly against the full previous recorded month, not a claim of complete bank coverage.

## Synchronisation and automation

The Worker cron runs at minute 17 every four hours. It checks cached bank data, independently of an open browser. It does **not** force bank refreshes. An in-flight promise coalesces concurrent syncs in the owner Durable Object. Temporary GET network/502/503/504 failures retry with bounded exponential delays; auth failures and rate limits are not hammered. Failed scheduled runs retry on the next cron. Failed requests never masquerade as empty history.

The full accessible window is rescanned to observe bank corrections. Stable settled IDs are upserted; Akahu migration IDs preserve local identity. A unique pending candidate with equal amount/account/description within seven days can be promoted in place. Ambiguous pending matches remain separate and require investigation. Missing pending records are retained with a missing-pending status. Settled records absent from a complete in-window scan are flagged for investigation, never automatically deleted or declared reversed. Unknown replacement IDs cannot safely be guessed from amounts alone.

Manual bank refresh reserves a one-hour cooldown before the request, including uncertain network outcomes. A request is not completion: inspect Accounts' provider refresh timestamps after checking available data. Requests made outside this app may impose additional Akahu cooldowns. The browser's minute timer only reads local metadata; it never polls Akahu directly.

## Notifications

The persistent in-app notification centre, sidebar unread badge and review inbox distinguish unread from reviewed. New settled transactions after the baseline create at most one persisted discovery notification each. Pending transactions are reviewable, but push waits for settlement to avoid unstable pending-identity alerts. Automatically categorised transactions still require personal review.

Web Push uses the existing service worker, standards-based payload encryption and VAPID. Configure backend `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (a real `mailto:` contact or HTTPS contact URL). The private key must be a raw server secret, not a proxy placeholder, and must never be exposed to clients. The public key is intentionally returned to authenticated clients. Use a vetted VAPID key-generation tool, store the pair privately, and set it through Worker secret settings. Replacing keys requires re-subscribing devices.

Enable push from Finance Settings through a user gesture, grant device permission, then send a test notification. Supported Android browsers and installed PWAs can receive alerts with the browser closed. iOS requires an eligible Home Screen web app (iOS/iPadOS 16.4+) and user-granted permission. Production requires HTTPS. Permission refusal leaves the review inbox usable. Only known Apple, Google and Mozilla HTTPS push endpoints are accepted; arbitrary URLs are rejected.

Delayed discoveries are combined into private summaries. Per-device/per-event delivery records avoid re-sending accepted events when another device fails. Expired subscriptions are removed. A network failure after a push service accepts a payload remains an unavoidable delivery ambiguity; stable notification tags reduce visible duplicates. Real-device delivery is not proven by automated mocks. Disabling delivery retains bookkeeping and inbox records.

## Reports, receipts, backups

CSV and XLSX cover monthly/annual summaries, income/expense, cash flow, categories, merchants, transaction registers, observed balance history, budgets versus actual, confirmed recurring payments and custom periods. Filters apply to all matching pages. Workbooks contain numeric monetary values, real date cells, source IDs, summary sheets and reference sheets. CSV text is protected against formula injection. Budget reports describe the current configured budget period; they are not historical budget-version reconstructions. PDF and scheduled report generation are not implemented.

Authenticated downloads use private/no-store headers. Export events are retained in the database; report binaries are generated on demand. Reports are not placed at public storage URLs. Receipts are private SQLite blobs with metadata and transaction references; accepted formats are PNG, JPEG, WebP and PDF up to 1 MB, with header checks and forced attachment downloads. No OCR runs.

Finance Settings offers a complete private JSON backup, including raw bank facts and receipts. Push subscriptions/keys are excluded. Backups are unencrypted downloads: keep them in encrypted private storage. Restore requires explicit typed confirmation, validates the format, uses an atomic SQLite transaction and replaces only Finance data. Interactive restoration is limited to 8 MB. Large archives need an administrator recovery procedure; do not rely on an untested restore. Take regular backups and test restoration on a separate local environment. Cloudflare storage retention is not a substitute for independent backups. There is no scheduled encrypted offsite backup job.

## Deployment and verification boundaries

`npm run validate` runs structure/import guardrails, browser/Worker TypeScript, Vitest and the production build. There is no separate lint script. `worker:dry-run` bundles the Worker without publishing it. Deploy through the existing deployment process only when authorised; setting secrets, publishing an onboarding snapshot, and deploying production code are separate operations.

The verification run passed 254 tests, both TypeScript targets, guardrails, the Vite build and Worker dry-run. A repeated frozen installation passed. Production dependency audit reports zero known vulnerabilities; ExcelJS uses a scoped UUID v11 override for the v4 API it consumes, with real workbook generation tested.

The local suite covers money, NZ dates, pagination including empty pages, API failures, idempotency, preserved annotations, pending promotion, historical retention, concurrency, refresh cooldown, transfer/refund totals, split budgets, formula escaping, real XLSX types, report variants, private receipt validation, recurring confirmation, push retry deduplication and backup restoration. Chromium checks exercise authentication, CSRF, navigation, persistence, export and narrow layouts.

Still requiring live configuration and verification: real ANZ authentication/history/permissions, bank-specific pending/settled changes, Akahu refresh completion, deployed cron execution and actual Android/iOS push delivery. No production deployment or live bank import was performed. Advanced statistical comparisons, regex and amount-conditioned categorisation, merchant-alias management, scheduled review reminders, budget-threshold push, full notification preference granularity and automated encrypted offsite backups remain outside the implemented paths. The full master acceptance checklist is therefore not yet satisfied.

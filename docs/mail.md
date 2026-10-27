# Mail

27 October 2026: first infrastructure stage, implemented locally. Mail is a workspace section available in the desktop sidebar and phone drawer. It contains a unified-inbox entry point and an account setup list for multiple Gmail, Proton Mail and Purelymail mailboxes, including custom-domain addresses.

## Working now

- Add, edit, search and remove account setup records. Each contains a provider, email address and optional label.
- Records persist in the existing private workspace’s SQLite Durable Object. Signed-in devices share the registry; reopening Mail or choosing **Reload accounts** fetches the latest records.
- Select all accounts or an individual mailbox in the inbox. Until connections exist, the view explains setup rather than showing invented messages or a misleading empty-inbox count.
- Every account says **Setup required**. Saving metadata does not authorize access, import messages or verify ownership of the address. Removal affects only Task Set’s setup record.
- Forms keep their draft after failed saves. The API rejects duplicate addresses, invalid input, credential fields, oversized bodies and more than 100 records. Account IDs make retrying a save idempotent.
- Existing session, same-origin write checks and private/no-store responses apply. No passwords, tokens or mail bodies are collected. Account setup depends on the server and is unavailable offline.

## Provider connection paths

**Gmail:** use the Gmail API with a Google OAuth web application and separate consent for each mailbox. Start with `gmail.readonly`; this is a restricted scope. Follow Google’s verification requirements and applicable personal-use/testing exceptions when configuring the actual app. OAuth initiation/callback, state protection, encrypted server-side refresh-token storage, revocation and mail ingestion remain to be implemented. [Google’s scope reference](https://developers.google.com/workspace/gmail/api/auth/scopes).

**Proton Mail:** Bridge requires a paid Proton Mail plan and runs on a computer. It decrypts mail locally and provides local IMAP/SMTP access. A hosted Worker cannot directly reach the user’s local Bridge; choose and implement an authenticated companion connection before promising Proton inbox sync. Do not expose Bridge publicly or request Proton passwords in this web app. [Proton setup](https://proton.me/support/imap-smtp-and-pop3-setup), [why Bridge is required](https://proton.me/support/why-you-need-bridge).

**Purelymail:** incoming mail uses `imap.purelymail.com:993` with SSL/TLS, the full mailbox address as username, and an app password when two-factor authentication is enabled. Multiple aliases may route to one mailbox; register the underlying mailbox once when linking. The IMAP ingestion connector and secure server-side credential storage remain to be implemented. SMTP is separate future sending work, not required for an initial read-only inbox. [Purelymail technical setup](https://purelymail.com/docs/setup/technical).

## Next stage

Implement the provider authorization/credential boundary before enabling a Connect action. Add normalized message storage keyed by account plus provider message ID, per-account incremental sync cursors and failures, and authenticated paginated unified-inbox reads. Then build real message rows, search, reading, attachment handling and safe mail-content rendering. Do not treat the setup list as a mail cache. Sending, reply, archive and read-state writes are outside this first stage.

Verify live authorization, token renewal/revocation, partial account failures, reconnection, pagination and duplicate-free incremental imports with the owner’s accounts before claiming live mail works. No provider has been linked and no deployment is performed by this stage.

## Direction contract

**THESIS:** One Mail section gathers the owner’s mailboxes, with clear setup state before live messages exist.

**OWN-WORLD:** Inherit Task Set’s paper canvas, system typography, amber controls, hairline rows, native dialog and phone drawer. No new visual system.

**STORY:** Open the unified inbox, save each account, then review the provider’s actual connection requirements.

**FIRST VIEWPORT:** Existing Mail header with Add account and search; Unified inbox/Accounts tabs; setup notice; mailbox selector and a truthful first-use state. Accounts use a simple list with progressive setup details.

**FORM:** Extension of the established workspace. The user specified a unified mailbox and provider setup; no visual-world selection is needed.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

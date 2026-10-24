import { useState } from 'react'
import type { FinanceData } from '../../../shared/types/finance'
import { financeTime } from '../../../shared/utils/finance'
export default function FinanceSettings({
  data,
  busy,
  onCommand,
  onPush,
  onRefresh,
  onOpen,
  onRestore,
}: {
  data: FinanceData
  onRestore: (file: File) => void
  onOpen: (id: string) => void
  busy: boolean
  onCommand: (path: string, value: unknown) => void
  onPush: () => void
  onRefresh: () => void
}) {
  const [confirmation, setConfirmation] = useState('')
  const cooling =
    !!data.refreshRequestedAt &&
    Date.now() - Date.parse(data.refreshRequestedAt) < 3600000
  return (
    <section>
      <h2>Bank connection</h2>
      <p>
        {data.configured
          ? 'Server credentials configured'
          : 'Akahu credentials missing on this server'}
      </p>
      <p>
        Import status:{' '}
        {data.initialized
          ? 'Initial import complete'
          : 'Awaiting complete initial import'}{' '}
        · {data.accounts.length} accounts · {data.transactionCount} transactions
      </p>
      <p>Earliest available transaction: {financeTime(data.earliest)}</p>
      <p>Last application sync: {financeTime(data.lastSync)}</p>
      <p>Last refresh request: {financeTime(data.refreshRequestedAt)}</p>
      <button
        disabled={busy || cooling || !data.configured}
        onClick={onRefresh}
      >
        {cooling ? 'Refresh cooldown active' : 'Request bank refresh'}
      </button>
      <p className="finance-muted">
        A request is asynchronous. Check bank refresh timestamps in Accounts to
        establish whether fresh data has arrived. The one-hour restriction also
        applies outside this app.
      </p>
      <h2>Notifications</h2>
      <label className="finance-check">
        <input
          type="checkbox"
          checked={data.settings.notifications}
          disabled={busy}
          onChange={(e) =>
            onCommand('settings', {
              ...data.settings,
              notifications: e.target.checked,
            })
          }
        />
        New settled-transaction alerts
      </label>
      <label className="finance-check">
        <input
          type="checkbox"
          checked={data.settings.push}
          disabled={busy}
          onChange={(e) =>
            onCommand('settings', { ...data.settings, push: e.target.checked })
          }
        />
        Web Push delivery
      </label>
      <p>
        Lock-screen alerts use private summary text. Pending transactions appear
        in the review inbox; alerts wait for settlement.
      </p>
      <button disabled={busy || !data.vapidPublicKey} onClick={onPush}>
        Enable push on this device
      </button>
      <button
        disabled={busy || !data.settings.push}
        onClick={() => onCommand('push/test', {})}
      >
        Send test notification
      </button>
      <p>
        Requires HTTPS and notification permission. On iOS 16.4+, install to the
        Home Screen first. Supported Android browsers and installed PWAs can
        receive alerts with the browser closed.
      </p>
      <h2>Private data backup</h2>
      <p>
        <a href="/api/finance/backup" download>
          Download complete Finance backup
        </a>
      </p>
      <p>
        This includes bank facts, raw imported transactions, bookkeeping,
        receipts and settings. Store it in encrypted private storage. Push
        credentials are excluded.
      </p>
      <details>
        <summary>Restore a Finance backup</summary>
        <p>
          This replaces all local Finance data, including newer edits. Other app
          sections are unaffected. Download a current backup first. Interactive
          restore is limited to 8 MB.
        </p>
        <label>
          Type RESTORE FINANCE BACKUP
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </label>
        <input
          aria-label="Finance backup file"
          type="file"
          accept="application/json"
          disabled={busy || confirmation !== 'RESTORE FINANCE BACKUP'}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onRestore(file)
            setConfirmation('')
            e.target.value = ''
          }}
        />
      </details>
      <h2>Notification centre</h2>
      <p>
        {data.unreadCount} unread discoveries. Read status is separate from
        transaction review status.
      </p>
      {data.notifications.slice(0, 30).map((n) => (
        <p key={n.id}>
          <button onClick={() => onOpen(n.transactionId)}>
            {n.readAt ? 'Read' : 'Unread'} · Detected {financeTime(n.createdAt)}{' '}
            · Open review
          </button>
        </p>
      ))}
      <h2>Preferences</h2>
      <p>Currency: NZD · Timezone: Pacific/Auckland</p>
      <h2>Synchronisation history</h2>
      {data.syncs.map((s) => (
        <article key={s.id}>
          <strong>{s.status}</strong> · {financeTime(s.startedAt)} ·{' '}
          {s.imported} new records{s.error && <p role="status">{s.error}</p>}
        </article>
      ))}
    </section>
  )
}

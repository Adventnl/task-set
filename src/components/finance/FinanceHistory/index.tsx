import { useState } from 'react'
import type { FinanceData } from '../../../shared/types/finance'
import { financeTime } from '../../../shared/utils/finance'
import FinancePagination from '../FinancePagination'
export default function FinanceHistory({
  data,
  busy,
  onOpen,
}: {
  data: FinanceData
  busy: boolean
  onOpen: (id: string) => void
}) {
  const [syncPage, setSyncPage] = useState(0)
  const [notificationPage, setNotificationPage] = useState(0)
  const [onlyFailures, setOnlyFailures] = useState(false)
  const syncs = data.syncs.filter((s) => !onlyFailures || s.status === 'failed')
  const currentSync = Math.min(
    syncPage,
    Math.max(0, Math.ceil(syncs.length / 5) - 1),
  )
  const currentNotification = Math.min(
    notificationPage,
    Math.max(0, Math.ceil(data.notifications.length / 5) - 1),
  )
  return (
    <div className="finance-settings-stack">
      <section className="finance-panel">
        <div className="finance-panel-heading">
          <div>
            <h2>Sync history</h2>
            <p>
              The latest {data.syncs.length} sync runs. Automatic checks run
              every five minutes while Finance is open.
            </p>
          </div>
        </div>
        <label className="finance-check">
          <input
            type="checkbox"
            checked={onlyFailures}
            onChange={(e) => {
              setOnlyFailures(e.target.checked)
              setSyncPage(0)
            }}
          />
          Only failed runs
        </label>
        <div className="finance-history-list">
          {syncs.slice(currentSync * 5, (currentSync + 1) * 5).map((s) => (
            <article key={s.id}>
              <div>
                <span
                  className={`finance-status ${s.status === 'failed' ? 'is-failed' : ''}`}
                >
                  {s.status}
                </span>
                <time>{financeTime(s.startedAt)}</time>
                <span>{s.imported} new records</span>
              </div>
              {s.error && <p className="finance-error">{s.error}</p>}
            </article>
          ))}
        </div>
        {!syncs.length && (
          <p className="finance-panel-empty">
            {onlyFailures
              ? 'No failed runs in recent history.'
              : 'No sync runs yet.'}
          </p>
        )}
        <FinancePagination
          page={currentSync}
          total={syncs.length}
          size={5}
          noun="runs"
          loading={busy}
          onPage={setSyncPage}
        />
      </section>
      <section className="finance-panel">
        <h2>
          Notification centre{' '}
          <span className="finance-count">{data.unreadCount} unread</span>
        </h2>
        <p className="finance-muted">
          Read status is separate from transaction review status. Showing up to
          200 recent discoveries.
        </p>
        {data.notifications
          .slice(currentNotification * 5, (currentNotification + 1) * 5)
          .map((n) => (
            <div className="finance-notification-row" key={n.id}>
              <span>
                <span className="finance-status">
                  {n.readAt ? 'Read' : 'Unread'}
                </span>
                <small>{financeTime(n.createdAt)}</small>
              </span>
              <button disabled={busy} onClick={() => onOpen(n.transactionId)}>
                Open transaction
              </button>
            </div>
          ))}
        {!data.notifications.length && (
          <p className="finance-panel-empty">
            No transaction notifications yet.
          </p>
        )}
        <FinancePagination
          page={currentNotification}
          total={data.notifications.length}
          size={5}
          noun="notifications"
          loading={busy}
          onPage={setNotificationPage}
        />
      </section>
    </div>
  )
}

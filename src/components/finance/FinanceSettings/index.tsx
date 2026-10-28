import { useState } from 'react'
import { CheckCircle2, Download, RefreshCw } from 'lucide-react'
import type { FinanceData } from '../../../shared/types/finance'
import { financeTime } from '../../../shared/utils/finance'
import FinanceRules from '../FinanceRules'
import FinanceHistory from '../FinanceHistory'
const SECTIONS = [
  'Connection',
  'Notifications',
  'Category rules',
  'Data & preferences',
  'Activity',
] as const
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
  const [section, setSection] =
    useState<(typeof SECTIONS)[number]>('Connection')
  const [confirmation, setConfirmation] = useState('')
  const cooling =
    !!data.refreshRequestedAt &&
    Date.now() - Date.parse(data.refreshRequestedAt) < 3600000
  return (
    <div className="finance-settings">
      <nav
        className="finance-settings-nav"
        aria-label="Finance settings sections"
      >
        {SECTIONS.map((s) => (
          <button
            key={s}
            aria-current={section === s ? 'page' : undefined}
            onClick={() => setSection(s)}
          >
            {s}
          </button>
        ))}
      </nav>
      {section === 'Connection' && (
        <section className="finance-panel finance-settings-panel">
          <div className="finance-panel-heading">
            <div>
              <h2>Bank connection</h2>
              <p>Account access and the latest imported data.</p>
            </div>
            <span className="finance-status">
              {data.initialized ? (
                <>
                  <CheckCircle2 size={14} aria-hidden="true" />
                  Import complete
                </>
              ) : data.configured ? (
                'Ready to import'
              ) : (
                'Setup required'
              )}
            </span>
          </div>
          <dl className="finance-setting-facts">
            <div>
              <dt>Provider</dt>
              <dd>Akahu Personal App</dd>
            </div>
            <div>
              <dt>Server credentials</dt>
              <dd>
                {data.configured ? 'Configured' : 'Missing on this server'}
              </dd>
            </div>
            <div>
              <dt>Imported records</dt>
              <dd>
                {data.accounts.length} accounts ·{' '}
                {data.transactionCount.toLocaleString()} transactions
              </dd>
            </div>
            <div>
              <dt>Earliest transaction</dt>
              <dd>{financeTime(data.earliest)}</dd>
            </div>
            <div>
              <dt>Last application sync</dt>
              <dd>{financeTime(data.lastSync)}</dd>
            </div>
            <div>
              <dt>Last refresh request</dt>
              <dd>{financeTime(data.refreshRequestedAt)}</dd>
            </div>
          </dl>
          <div className="finance-setting-action">
            <div>
              <h3>Request fresh bank data</h3>
              <p>
                Bank refreshes are asynchronous and limited to once an hour.
                Check Accounts for updated bank timestamps.
              </p>
            </div>
            <button
              disabled={busy || cooling || !data.configured}
              onClick={onRefresh}
            >
              <RefreshCw size={15} aria-hidden="true" />
              {cooling ? 'Refresh cooldown active' : 'Request bank refresh'}
            </button>
          </div>
          <button
            className="finance-link"
            onClick={() => setSection('Activity')}
          >
            View recent sync activity
          </button>
        </section>
      )}
      {section === 'Notifications' && (
        <section className="finance-panel finance-settings-panel">
          <h2>Notifications</h2>
          <p className="finance-muted">
            Private alerts for new settled transactions. Pending payments stay
            in the review inbox until settlement.
          </p>
          <div className="finance-setting-action">
            <div>
              <h3>Transaction alerts</h3>
              <p>
                Keep a notification when a new settled transaction is
                discovered.
              </p>
            </div>
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
              Enabled
            </label>
          </div>
          <div className="finance-setting-action">
            <div>
              <h3>Web Push delivery</h3>
              <p>Send private summary text to subscribed devices.</p>
            </div>
            <label className="finance-check">
              <input
                type="checkbox"
                checked={data.settings.push}
                disabled={busy}
                onChange={(e) =>
                  onCommand('settings', {
                    ...data.settings,
                    push: e.target.checked,
                  })
                }
              />
              Enabled
            </label>
          </div>
          <div className="finance-actions">
            <button disabled={busy || !data.vapidPublicKey} onClick={onPush}>
              Enable push on this device
            </button>
            <button
              disabled={busy || !data.settings.push}
              onClick={() => onCommand('push/test', {})}
            >
              Send test notification
            </button>
          </div>
          {!data.vapidPublicKey && (
            <p className="finance-muted">
              Device push needs server VAPID keys to be configured.
            </p>
          )}
          <details>
            <summary>Device requirements</summary>
            <p>
              Requires HTTPS and notification permission. On iOS 16.4+, install
              to the Home Screen first. Supported Android browsers and installed
              PWAs can receive alerts with the browser closed.
            </p>
          </details>
          <button
            className="finance-link"
            onClick={() => setSection('Activity')}
          >
            Open notification centre ({data.unreadCount} unread)
          </button>
        </section>
      )}
      {section === 'Category rules' && (
        <section className="finance-panel finance-settings-panel">
          <h2>Automatic categorisation</h2>
          <p className="finance-muted">
            Rules apply to future imported transactions. Your manual category
            choices are preserved.
          </p>
          <FinanceRules data={data} busy={busy} onCommand={onCommand} />
        </section>
      )}
      {section === 'Data & preferences' && (
        <section className="finance-panel finance-settings-panel">
          <h2>Data & preferences</h2>
          <dl className="finance-setting-facts">
            <div>
              <dt>Currency</dt>
              <dd>NZD</dd>
            </div>
            <div>
              <dt>Timezone</dt>
              <dd>Pacific/Auckland</dd>
            </div>
          </dl>
          <div className="finance-setting-action">
            <div>
              <h3>Private data backup</h3>
              <p>
                Includes bank records, bookkeeping, receipts and settings. Store
                in encrypted private storage. Push credentials are excluded.
              </p>
            </div>
            <a className="finance-button" href="/api/finance/backup" download>
              <Download size={15} aria-hidden="true" />
              Download backup
            </a>
          </div>
          <details>
            <summary>Restore a Finance backup</summary>
            <p>
              This replaces all Finance data, including newer edits. Download a
              current backup first. Interactive restore supports files up to 8
              MB.
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
        </section>
      )}
      {section === 'Activity' && (
        <FinanceHistory data={data} busy={busy} onOpen={onOpen} />
      )}
    </div>
  )
}

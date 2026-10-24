import FinanceBalanceChart from '../FinanceBalanceChart'
import type { FinanceData } from '../../../shared/types/finance'
import { financeTime, money } from '../../../shared/utils/finance'
export default function FinanceAccounts({
  data,
  busy,
  onCommand,
}: {
  data: FinanceData
  busy: boolean
  onCommand: (path: string, value: unknown) => void
}) {
  return (
    <section>
      <h2>Connected accounts</h2>
      {!data.accounts.length && (
        <p>
          No accounts imported yet. Configure your server credentials, then
          check available data.
        </p>
      )}
      {data.accounts.map((a) => (
        <article className="finance-account" key={a.id}>
          <h3>{a.name}</h3>
          <div className="finance-actions">
            <button
              disabled={busy}
              onClick={() =>
                onCommand('accounts', {
                  id: a.id,
                  included: !a.included,
                  archived: a.archived,
                })
              }
            >
              {a.included
                ? 'Exclude from balance totals'
                : 'Include in balance totals'}
            </button>
            <button
              disabled={busy}
              onClick={() =>
                onCommand('accounts', {
                  id: a.id,
                  included: a.included,
                  archived: !a.archived,
                })
              }
            >
              {a.archived ? 'Restore account' : 'Archive account'}
            </button>
          </div>
          <p>
            {a.institution} · {a.type} · {a.masked} · {a.status}
          </p>
          <p>
            Current: <strong>{money(a.current, a.currency)}</strong> ·
            Available: <strong>{money(a.available, a.currency)}</strong>
          </p>
          <p>
            Bank balance refreshed: {financeTime(a.balanceAt)}
            <br />
            Bank transactions refreshed: {financeTime(a.transactionsAt)}
            <br />
            Application observed: {financeTime(a.syncedAt)}
          </p>
          <FinanceBalanceChart
            balances={data.balances.filter((b) => b.accountId === a.id)}
          />
          <details>
            <summary>Observed balance history</summary>
            <p>
              Snapshots are bank observations, not reconstructed intraday
              balances. Gaps represent unavailable history. This view shows up
              to the latest 2,000 observations across accounts; use the
              balance-history report for the complete retained dataset.
            </p>
            {data.balances
              .filter((b) => b.accountId === a.id)
              .map((b, i) => (
                <p key={i}>
                  {financeTime(b.reportedAt)} · {money(b.current, b.currency)}{' '}
                  current · {money(b.available, b.currency)} available{' '}
                  <small>(observed {financeTime(b.observedAt)})</small>
                </p>
              ))}
          </details>
        </article>
      ))}
    </section>
  )
}

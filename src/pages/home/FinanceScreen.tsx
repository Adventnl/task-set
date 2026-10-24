import FinanceAnalytics from '../../components/finance/FinanceAnalytics'
import type { FinanceController } from '../../shared/hooks/useFinance'
import type { FinanceTab } from '../../shared/types/finance'
import FinanceOverview from '../../components/finance/FinanceOverview'
import FinanceTransactions from '../../components/finance/FinanceTransactions'
import FinanceReview from '../../components/finance/FinanceReview'
import FinanceAccounts from '../../components/finance/FinanceAccounts'
import FinanceSettings from '../../components/finance/FinanceSettings'
import FinanceReports from '../../components/finance/FinanceReports'
import FinanceBudgets from '../../components/finance/FinanceBudgets'
const TABS: FinanceTab[] = [
  'Overview',
  'Review Inbox',
  'Transactions',
  'Accounts',
  'Budgets & Categories',
  'Analytics',
  'Reports',
  'Finance Settings',
]
export default function FinanceScreen({
  finance: f,
}: {
  finance: FinanceController
}) {
  const d = f.data
  return (
    <div className="finance">
      <nav className="finance-nav" aria-label="Finance sections">
        {TABS.map((tab) => (
          <button
            key={tab}
            aria-current={tab === f.tab ? 'page' : undefined}
            onClick={() => f.choose(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>
      <div className="finance-actions">
        <button
          disabled={f.busy || !d?.configured}
          onClick={() => void f.sync()}
        >
          {f.busy ? 'Working…' : 'Check available data'}
        </button>
        {d && <small>{d.transactionCount} retained transactions</small>}
      </div>
      {f.error && (
        <p className="finance-error" role="alert">
          {f.error}
        </p>
      )}
      {f.message && <p role="status">{f.message}</p>}
      {!d ? (
        <p>Loading private financial records…</p>
      ) : (
        <>
          {!d.initialized && (
            <article className="finance-empty">
              <h2>Connect your financial history</h2>
              <p>
                {d.configured
                  ? 'Your server has Akahu credentials. Check available data to validate access and import the available history.'
                  : 'Configure AKAHU_APP_TOKEN and AKAHU_USER_TOKEN as backend secrets. Then check available data to import your connected accounts and available history.'}
              </p>
              <p>
                Initial history imports silently. Your notes and categories are
                stored separately from bank facts. No AI is used.
              </p>
            </article>
          )}
          {f.tab === 'Analytics' && (
            <FinanceAnalytics
              recurring={f.recurring}
              busy={f.busy}
              onCommand={f.command}
              metrics={f.metrics}
              categories={d.categories}
              filter={f.filter}
              onFilter={f.setFilter}
              onDrill={(patch) => {
                f.choose('Transactions')
                f.setFilter(patch)
              }}
            />
          )}
          {f.tab === 'Overview' && (
            <FinanceOverview
              metrics={f.metrics}
              data={d}
              page={f.page}
              analytics={false}
              onReview={() => f.choose('Review Inbox')}
              onCategory={(id) => {
                f.choose('Transactions')
                f.setFilter({ category: id })
              }}
            />
          )}
          {(f.tab === 'Transactions' || f.tab === 'Review Inbox') && (
            <>
              <h2>
                {f.tab === 'Review Inbox'
                  ? 'What was this transaction for?'
                  : 'Transaction register'}
              </h2>
              {f.tab === 'Review Inbox' && f.metrics && (
                <p>
                  {f.metrics.reviewCount} awaiting review · Income NZ$
                  {(f.metrics.reviewIncome / 100).toFixed(2)} · Expenses NZ$
                  {(f.metrics.reviewExpenses / 100).toFixed(2)}
                </p>
              )}
              <FinanceTransactions
                data={d}
                page={f.page}
                filter={
                  f.tab === 'Review Inbox'
                    ? { ...f.filter, review: f.filter.review || 'needs-review' }
                    : f.filter
                }
                busy={f.busy}
                onBulk={(ids, category) =>
                  void f.command('bulk', { ids, category, review: 'reviewed' })
                }
                onFilter={f.setFilter}
                onOpen={f.open}
              />
            </>
          )}
          {f.tab === 'Accounts' && (
            <FinanceAccounts data={d} busy={f.busy} onCommand={f.command} />
          )}
          {f.tab === 'Finance Settings' && (
            <FinanceSettings
              onRestore={(file) => void f.restore(file)}
              onOpen={f.open}
              data={d}
              busy={f.busy}
              onCommand={f.command}
              onPush={() => void f.push()}
              onRefresh={() => void f.refresh()}
            />
          )}
          {f.tab === 'Reports' && (
            <FinanceReports
              busy={f.busy}
              onExport={(format, type) => void f.export(format, type)}
            />
          )}
          {f.tab === 'Budgets & Categories' && (
            <FinanceBudgets
              metrics={f.metrics}
              data={d}
              busy={f.busy}
              onCommand={f.command}
            />
          )}
          {f.transaction && (
            <FinanceReview
              key={f.transaction.id}
              transaction={f.transaction}
              error={f.error}
              detail={f.detail}
              onUpload={(file) => void f.upload(file)}
              categories={d.categories}
              busy={f.busy}
              onClose={f.close}
              onSave={(input, next) => void f.save(input, next)}
              onMatch={(other, kind) =>
                void f.command('match', {
                  first: f.transaction?.id,
                  second: other,
                  kind,
                })
              }
            />
          )}
        </>
      )}
    </div>
  )
}

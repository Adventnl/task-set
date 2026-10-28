import FinanceAnalytics from '../../components/finance/FinanceAnalytics'
import type { FinanceController } from '../../shared/hooks/useFinance'
import FinanceOverview from '../../components/finance/FinanceOverview'
import FinanceTransactions from '../../components/finance/FinanceTransactions'
import FinanceReview from '../../components/finance/FinanceReview'
import FinanceAccounts from '../../components/finance/FinanceAccounts'
import FinanceSettings from '../../components/finance/FinanceSettings'
import FinanceReports from '../../components/finance/FinanceReports'
import FinanceCategories from '../../components/finance/FinanceCategories'
import FinanceWorkbook from '../../components/finance/FinanceWorkbook'
import FinanceReceiptMatch from '../../components/finance/FinanceReceiptMatch'
import FinancePeriod from '../../components/finance/FinancePeriod'
import { Download, RefreshCw, ShieldCheck } from 'lucide-react'
import { financeTime } from '../../shared/utils/finance'
import FinanceNavigation from '../../components/finance/FinanceNavigation'
export default function FinanceScreen({
  finance: f,
}: {
  finance: FinanceController
}) {
  const d = f.data
  return (
    <div className="finance">
      <FinanceNavigation
        tab={f.tab}
        reviewCount={f.metrics?.reviewCount ?? 0}
        transactionCount={d?.transactionCount ?? 0}
        onChoose={f.choose}
      />
      <div className="finance-main" ref={f.canvasRef}>
        <div className="finance-toolbar">
          <div>
            <h2>
              {f.tab === 'Overview'
                ? 'Overview'
                : f.tab === 'Finance Settings'
                  ? 'Finance settings'
                  : f.tab}
            </h2>
            <p>
              {d?.lastSync
                ? `Last synced ${financeTime(d.lastSync)}`
                : d?.configured
                  ? 'Akahu configured · awaiting first successful sync'
                  : 'Connect your bank to get started'}
            </p>
          </div>
          {d &&
            !f.workbook &&
            [
              'Overview',
              'Transactions',
              'Review Inbox',
              'Analytics',
              'Accounts',
              'Reports',
            ].includes(f.tab) && (
              <FinancePeriod filter={f.filter} onFilter={f.setFilter} />
            )}
          <div className="finance-toolbar-actions">
            <button
              disabled={f.busy || !d?.initialized}
              title="Reports and exports"
              aria-label="Reports and exports"
              onClick={() => f.choose('Reports')}
            >
              <Download size={15} aria-hidden="true" />
              <span className="finance-action-label">Export</span>
            </button>
            <button
              className="finance-primary"
              title="Sync accounts"
              aria-label={f.busy ? 'Working' : 'Sync accounts'}
              disabled={f.busy || !d?.configured}
              onClick={() => void f.sync()}
            >
              <RefreshCw
                className={f.busy ? 'spin' : undefined}
                size={15}
                aria-hidden="true"
              />
              <span className="finance-action-label">
                {f.busy ? 'Working…' : 'Sync accounts'}
              </span>
            </button>
          </div>
        </div>
        {f.error && (
          <p className="finance-error" role="alert">
            {f.error}
          </p>
        )}
        {f.message && (
          <p className="finance-message" role="status">
            {f.message}
          </p>
        )}
        {!d ? (
          <p>Loading private financial records…</p>
        ) : (
          <>
            {!d.initialized && (
              <article className="finance-empty">
                <ShieldCheck size={24} aria-hidden="true" />
                <div>
                  <h3>
                    {d.configured
                      ? f.busy
                        ? 'Importing your financial history'
                        : 'Your bank connection is ready to import'
                      : 'Connect your financial history'}
                  </h3>
                  <p>
                    {d.configured
                      ? 'The first sync imports your accounts and available transactions. If it fails, the error appears here and you can retry with Sync accounts.'
                      : 'Add your Akahu Personal App credentials to the server to import balances and transactions.'}
                  </p>
                </div>
              </article>
            )}
            {d.syncs[0]?.status === 'failed' && !f.error && (
              <p className="finance-error" role="alert">
                Last bank sync failed: {d.syncs[0].error} Use Sync accounts to
                retry.
              </p>
            )}
            {f.tab === 'Analytics' && (
              <FinanceAnalytics
                recurring={f.recurring}
                busy={f.busy}
                onCommand={f.command}
                metrics={f.metrics}
                categories={d.categories}
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
                loading={f.loading}
                onDay={(day) => {
                  f.choose('Transactions')
                  f.setFilter({ start: day, end: day })
                }}
                onNavigate={f.choose}
                onOpen={f.open}
                onCategory={(id) => {
                  f.drillCategory(id)
                }}
              />
            )}
            {(f.tab === 'Transactions' || f.tab === 'Review Inbox') && (
              <>
                {f.tab === 'Review Inbox' && f.metrics && (
                  <p>
                    {f.metrics.reviewCount} awaiting review · Income NZ$
                    {(f.metrics.reviewIncome / 100).toFixed(2)} · Expenses NZ$
                    {(f.metrics.reviewExpenses / 100).toFixed(2)}
                  </p>
                )}
                <FinanceTransactions
                  loading={f.loading}
                  onReceipt={(file) => void f.matchReceipt(file)}
                  data={d}
                  page={f.page}
                  filter={
                    f.tab === 'Review Inbox'
                      ? {
                          ...f.filter,
                          review: f.filter.review || 'needs-review',
                        }
                      : f.filter
                  }
                  busy={f.busy}
                  onBulk={(ids, category) =>
                    f.command('bulk', { ids, category, review: 'reviewed' })
                  }
                  onFilter={f.setFilter}
                  onOpen={f.open}
                />
              </>
            )}
            {f.tab === 'Accounts' && (
              <FinanceAccounts
                data={d}
                filter={f.filter}
                busy={f.busy}
                onRefresh={() => void f.refresh()}
                onCommand={f.command}
              />
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
            {f.tab === 'Reports' && !f.workbook && (
              <FinanceReports
                reports={f.reports}
                filter={f.filter}
                loading={f.reportsLoading}
                onCreate={(type) => void f.createWorkbook(type)}
                onPreview={(id) => void f.previewWorkbook(id)}
                busy={f.busy}
                onExport={(format, type) => void f.export(format, type)}
              />
            )}
            {f.tab === 'Categories' && (
              <FinanceCategories
                categories={d.categories.filter(
                  (c) => c.id !== 'uncategorized',
                )}
                counts={d.categoryCounts ?? {}}
                error={f.error}
                onOpen={f.drillCategory}
                onDelete={f.deleteCategory}
                busy={f.busy}
                onCommand={f.command}
              />
            )}
            {f.workbook && (
              <FinanceWorkbook
                workbook={f.workbook}
                busy={f.busy}
                title={
                  f.reports.find((r) => r.id === f.workbook?.id)?.type ??
                  'Excel workbook'
                }
                onClose={f.closeWorkbook}
                onBrowse={(sheet, page) =>
                  void f.previewWorkbook(f.workbook!.id, sheet, page)
                }
              />
            )}
            {f.receipt && (
              <FinanceReceiptMatch
                match={f.receipt.match}
                busy={f.busy}
                onAttach={(id) => void f.attachMatchedReceipt(id)}
                onClose={f.closeReceipt}
                error={f.error}
              />
            )}
            {f.transaction && (
              <FinanceReview
                key={f.transaction.id}
                transaction={f.transaction}
                accountLabel={d.accounts
                  .filter((a) => a.id === f.transaction?.accountId)
                  .map((a) => `${a.institution} | ${a.name} | ${a.type}`)
                  .join('')}
                onCreateCategory={f.createCategory}
                onDescribe={() => void f.describe()}
                insightError={f.insightError}
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
    </div>
  )
}

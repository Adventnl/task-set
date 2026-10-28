import { useState } from 'react'
import { Download, FileSpreadsheet, Plus, Search } from 'lucide-react'
import type {
  FinanceFilter,
  FinanceReport,
} from '../../../shared/types/finance'
import { financeTime } from '../../../shared/utils/finance'
import FinancePagination from '../FinancePagination'

export default function FinanceReports({
  busy,
  loading,
  reports,
  filter,
  onPreview,
  onCreate,
  onExport,
}: {
  onPreview: (id: string) => void
  onCreate: (type: string) => void
  reports: FinanceReport[]
  filter: FinanceFilter
  loading: boolean
  busy: boolean
  onExport: (format: string, type: string) => void
}) {
  const [type, setType] = useState('Transaction Register')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const matches = reports.filter((r) =>
    r.type.toLowerCase().includes(search.toLowerCase()),
  )
  const current = Math.min(
    page,
    Math.max(0, Math.ceil(matches.length / 10) - 1),
  )
  return (
    <div className="finance-report-workspace">
      <section className="finance-panel finance-report-create">
        <div>
          <h2>Create a report</h2>
          <p>
            View an Excel workbook here or download a CSV. Every report is saved
            to your library.
          </p>
        </div>
        <div className="finance-report-form">
          <label>
            Report type
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {[
                'Monthly Financial Summary',
                'Annual Financial Summary',
                'Income and Expense Statement',
                'Cash Flow Summary',
                'Category Spending Breakdown',
                'Merchant Spending Report',
                'Transaction Register',
                'Account Balance History',
                'Recurring Payment Summary',
                'Custom Date Range Report',
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <button
            className="finance-primary"
            disabled={busy}
            onClick={() => onCreate(type)}
          >
            <Plus size={16} aria-hidden="true" />
            {busy ? 'Working…' : 'Create & view Excel'}
          </button>
          <button disabled={busy} onClick={() => onExport('csv', type)}>
            <Download size={15} aria-hidden="true" />
            CSV
          </button>
        </div>
        <p className="finance-report-scope">
          {filter.start || 'All retained history'} →{' '}
          {filter.end || 'Latest available'} · All matching pages
          {filter.account ||
          filter.category ||
          filter.search ||
          filter.review ||
          filter.direction ||
          filter.tag ||
          filter.min ||
          filter.max
            ? ' · Transaction filters applied'
            : ''}
        </p>
      </section>
      <section className="finance-panel finance-reports" aria-busy={loading}>
        <div className="finance-panel-heading">
          <div>
            <h2>
              Report library{' '}
              <span className="finance-count">{reports.length}</span>
            </h2>
            <p>Open saved Excel workbooks directly in your browser.</p>
          </div>
        </div>
        <label className="finance-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search reports</span>
          <input
            type="search"
            placeholder="Find a report…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
          />
        </label>
        {!matches.length && (
          <div className="finance-panel-empty">
            <FileSpreadsheet size={28} aria-hidden="true" />
            <strong>
              {loading
                ? 'Loading your library…'
                : reports.length
                  ? 'No matching reports'
                  : 'Your reports, ready when you need them'}
            </strong>
            <p>
              {reports.length
                ? 'Try another report name.'
                : 'Choose a report above, then select Create & view Excel. You can switch sheets and browse every row.'}
            </p>
          </div>
        )}
        <div className="finance-report-library">
          {matches.slice(current * 10, (current + 1) * 10).map((report) => (
            <article key={report.id}>
              <FileSpreadsheet size={20} aria-hidden="true" />
              <div className="finance-report-info">
                <strong>{report.type}</strong>
                <small>
                  {financeTime(report.createdAt)} ·{' '}
                  {report.format.toUpperCase()} · {report.count} transactions
                </small>
                <small>
                  {report.filter.start || 'All history'} →{' '}
                  {report.filter.end || 'Latest available'}
                </small>
              </div>
              <div className="finance-actions">
                {report.saved && report.format === 'xlsx' && (
                  <button disabled={busy} onClick={() => onPreview(report.id)}>
                    View workbook
                  </button>
                )}
                {report.saved ? (
                  <a
                    className="finance-button"
                    href={`/api/finance/reports/${encodeURIComponent(report.id)}`}
                    download
                    aria-label={`Download ${report.type} ${report.format.toUpperCase()}`}
                  >
                    <Download size={15} aria-hidden="true" />
                    {report.format.toUpperCase()}
                  </a>
                ) : (
                  <small>File not retained · Create again above</small>
                )}
              </div>
            </article>
          ))}
        </div>
        <FinancePagination
          page={current}
          total={matches.length}
          size={10}
          noun="reports"
          loading={loading || busy}
          onPage={setPage}
        />
      </section>
    </div>
  )
}

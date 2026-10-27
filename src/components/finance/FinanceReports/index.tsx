import { useState } from 'react'
import type { FinanceReport } from '../../../shared/types/finance'
import { financeTime } from '../../../shared/utils/finance'
export default function FinanceReports({
  busy,
  reports,
  onPreview,
  onExport,
}: {
  onPreview: (id: string) => void
  reports: FinanceReport[]
  busy: boolean
  onExport: (format: string, type: string) => void
}) {
  const [type, setType] = useState('Transaction Register')
  return (
    <section className="finance-panel finance-reports">
      <h2>Create a report</h2>
      <p>
        Uses the selected dates and transaction filters across all pages.
        Workbooks are saved here so you can open or download them again.
      </p>
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
      <div className="finance-actions">
        <button disabled={busy} onClick={() => onExport('csv', type)}>
          Download CSV
        </button>
        <button disabled={busy} onClick={() => onExport('xlsx', type)}>
          Download Excel workbook
        </button>
      </div>
      <h3>Saved reports</h3>
      {!reports.length && (
        <p className="finance-muted">
          Your generated Excel workbooks and CSV reports will appear here.
        </p>
      )}
      <div className="finance-report-library">
        {reports.map((report) => (
          <article key={report.id}>
            <div>
              <strong>{report.type}</strong>
              <small>
                {financeTime(report.createdAt)} | {report.format.toUpperCase()}{' '}
                | {report.count} transactions
              </small>
              <small>
                {report.filter.start || 'All history'} |{' '}
                {report.filter.end || 'Latest available'}
              </small>
            </div>
            <div className="finance-actions">
              {report.saved && report.format === 'xlsx' && (
                <button disabled={busy} onClick={() => onPreview(report.id)}>
                  Open workbook
                </button>
              )}
              {report.saved ? (
                <a
                  href={`/api/finance/reports/${encodeURIComponent(report.id)}`}
                  download
                >
                  Download {report.format.toUpperCase()}
                </a>
              ) : (
                <small>Older export - file not retained</small>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

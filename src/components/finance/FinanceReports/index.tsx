import { useState } from 'react'
export default function FinanceReports({
  busy,
  onExport,
}: {
  busy: boolean
  onExport: (format: string, type: string) => void
}) {
  const [type, setType] = useState('Transaction Register')
  return (
    <section>
      <h2>Financial register & workbook</h2>
      <p>
        Exports use the current transaction filters and all matching pages. Set
        the period, account and category in Transactions first.
      </p>
      <p>
        The Excel workbook includes a cash-flow summary, transaction register,
        observed balances and category reference. Amounts are numeric and dates
        are real spreadsheet dates in UTC. Original bank IDs remain traceable.
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
            'Budget Versus Actual Report',
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
      <p className="finance-muted">
        Downloads contain private financial data. Store them securely. They do
        not modify your records.
      </p>
    </section>
  )
}

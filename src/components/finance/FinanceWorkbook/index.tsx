import { ArrowLeft, Download, FileSpreadsheet } from 'lucide-react'
import type { FinanceWorkbookPreview } from '../../../shared/types/finance'
import FinancePagination from '../FinancePagination'

export default function FinanceWorkbook({
  workbook,
  busy,
  title,
  onBrowse,
  onClose,
}: {
  workbook: FinanceWorkbookPreview & { id: string; sheetIndex: number }
  title: string
  busy: boolean
  onBrowse: (sheet: number, page: number) => void
  onClose: () => void
}) {
  const sheet = workbook.sheets[workbook.sheetIndex]
  return (
    <section className="finance-panel finance-workbook" aria-busy={busy}>
      <div className="finance-panel-heading">
        <div>
          <button className="finance-link" onClick={onClose}>
            <ArrowLeft size={16} aria-hidden="true" />
            All reports
          </button>
          <h2>
            <FileSpreadsheet size={19} aria-hidden="true" />
            {title}
          </h2>
          <p>
            Saved workbook · {workbook.sheets.length} sheets · Browse every row
            below
          </p>
        </div>
        <a
          className="finance-button"
          href={`/api/finance/reports/${encodeURIComponent(workbook.id)}`}
          download
        >
          <Download size={15} aria-hidden="true" />
          Download Excel
        </a>
      </div>
      <nav className="finance-sheet-tabs" aria-label="Workbook sheets">
        {workbook.sheets.map((s, i) => (
          <button
            key={s.name}
            disabled={busy}
            aria-pressed={i === workbook.sheetIndex}
            onClick={() => onBrowse(i, 0)}
          >
            {s.name}
            <span className="finance-count">
              {Math.max(0, s.totalRows - 1)}
            </span>
          </button>
        ))}
      </nav>
      {sheet && (
        <>
          <div className="finance-register-summary">
            <strong>{sheet.name}</strong>
            <span>
              {sheet.totalColumns} columns · {Math.max(0, sheet.totalRows - 1)}{' '}
              data rows
            </span>
          </div>
          <FinancePagination
            page={sheet.page}
            total={Math.max(0, sheet.totalRows - 1)}
            noun="rows"
            loading={busy}
            onPage={(page) => onBrowse(workbook.sheetIndex, page)}
          />
          <div
            className="finance-sheet-scroll"
            tabIndex={0}
            role="region"
            aria-label={`${sheet.name} spreadsheet; scroll for more columns`}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col" aria-label="Row number">
                    #
                  </th>
                  {sheet.rows[0]?.map((cell, i) => (
                    <th scope="col" key={i}>
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.rows.slice(1).map((row, i) => (
                  <tr key={i}>
                    <th scope="row">{sheet.page * 50 + i + 2}</th>
                    {row.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sheet.totalRows <= 1 && (
            <p className="finance-panel-empty">This sheet has no data rows.</p>
          )}
          <FinancePagination
            page={sheet.page}
            total={Math.max(0, sheet.totalRows - 1)}
            noun="rows"
            loading={busy}
            onPage={(page) => onBrowse(workbook.sheetIndex, page)}
          />
        </>
      )}
    </section>
  )
}

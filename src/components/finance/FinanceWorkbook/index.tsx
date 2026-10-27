import { useState } from 'react'
import Modal from '../../app/Modal'
import type { FinanceWorkbookPreview } from '../../../shared/types/finance'
export default function FinanceWorkbook({
  workbook,
  onClose,
}: {
  workbook: FinanceWorkbookPreview
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  const sheet = workbook.sheets[index]
  return (
    <Modal labelledBy="finance-workbook-title" onClose={onClose}>
      <div className="finance-workbook">
        <div className="finance-panel-heading">
          <h2 id="finance-workbook-title">Excel workbook</h2>
          <button className="button" onClick={onClose}>
            Close
          </button>
        </div>
        <nav className="finance-sheet-tabs" aria-label="Workbook sheets">
          {workbook.sheets.map((s, i) => (
            <button
              className="button"
              key={s.name}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
            >
              {s.name}
            </button>
          ))}
        </nav>
        {sheet && (
          <>
            <p>
              {sheet.name} · {sheet.totalRows} rows. Preview shows up to 100
              rows and 20 columns.
            </p>
            <div className="finance-sheet-scroll">
              <table>
                <tbody>
                  {sheet.rows.map((row, i) => (
                    <tr key={i}>
                      <th scope="row">{i + 1}</th>
                      {row.map((cell, j) =>
                        i === 0 ? (
                          <th scope="col" key={j}>
                            {cell}
                          </th>
                        ) : (
                          <td key={j}>{cell}</td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

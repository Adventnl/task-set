import Modal from '../../app/Modal'
import type { FinanceReceiptMatch as ReceiptMatch } from '../../../shared/types/finance'
import { financeTime, money } from '../../../shared/utils/finance'
export default function FinanceReceiptMatch({
  match,
  busy,
  onAttach,
  onClose,
  error,
}: {
  match: ReceiptMatch
  busy: boolean
  onAttach: (id: string) => void
  onClose: () => void
  error: string
}) {
  return (
    <Modal labelledBy="finance-receipt-title" onClose={onClose}>
      <div className="finance-review">
        <div className="finance-panel-heading">
          <h2 id="finance-receipt-title">Match receipt</h2>
          <button onClick={onClose}>Close</button>
        </div>
        {error && (
          <p className="finance-error" role="alert">
            {error}
          </p>
        )}
        <p>
          {match.merchant} · {match.date} ·{' '}
          {money(match.amount, match.currency)}
        </p>
        <p>
          Check the extracted details, then choose a matching payment to attach
          your receipt.
        </p>
        {!match.candidates.length && (
          <p>
            No payments with this total and currency within three days. You can
            attach the receipt directly from a transaction.
          </p>
        )}
        {match.candidates.map((t) => (
          <button
            className="finance-receipt-candidate"
            disabled={busy}
            key={t.id}
            onClick={() => onAttach(t.id)}
          >
            <strong>{t.merchant}</strong>
            <span>
              {financeTime(t.date)} · {money(t.amount, t.currency)} · {t.status}
            </span>
            <span>Attach to this payment</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}

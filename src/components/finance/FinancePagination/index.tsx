import { paginationPages } from '../../../shared/utils/financePreferences'
export default function FinancePagination({
  page,
  total,
  loading,
  onPage,
  size = 50,
  noun = 'transactions',
}: {
  page: number
  total: number
  loading: boolean
  onPage: (page: number) => void
  size?: number
  noun?: string
}) {
  const count = Math.max(1, Math.ceil(total / size)),
    pages = paginationPages(page, total, size)
  return (
    <div className="finance-pagination">
      <span>
        {total
          ? `${page * size + 1}–${Math.min((page + 1) * size, total)} of ${total} ${noun}`
          : `0 ${noun}`}
        <small className="finance-page-position">
          Page {page + 1} of {count}
        </small>
      </span>
      <div aria-label={`${noun} pages`}>
        <button
          disabled={loading || page === 0}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        {pages.map((number, index) => (
          <span key={number} className="finance-page-number">
            {index > 0 && number - pages[index - 1] > 1 && (
              <span aria-hidden="true">…</span>
            )}
            <button
              aria-label={`Page ${number + 1} of ${count}`}
              aria-current={number === page ? 'page' : undefined}
              disabled={loading}
              onClick={() => onPage(number)}
            >
              {number + 1}
            </button>
          </span>
        ))}
        <button
          disabled={loading || (page + 1) * size >= total}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}

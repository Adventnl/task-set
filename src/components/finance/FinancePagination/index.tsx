import { paginationPages } from '../../../shared/utils/financePreferences'
export default function FinancePagination({
  page,
  total,
  loading,
  onPage,
}: {
  page: number
  total: number
  loading: boolean
  onPage: (page: number) => void
}) {
  const count = Math.max(1, Math.ceil(total / 50)),
    pages = paginationPages(page, total)
  return (
    <div className="finance-pagination">
      <span>
        {total
          ? `${page * 50 + 1}–${Math.min((page + 1) * 50, total)} of ${total}`
          : '0 transactions'}
      </span>
      <div>
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
          disabled={loading || (page + 1) * 50 >= total}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}

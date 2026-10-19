import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Pagination Stisla v3 + baris keterangan "Showing …" di footer kartu.
 */
export function AdminPagination({
  page,
  pageSize,
  total,
  unitLabel,
  onPage,
  disabled,
}: {
  page: number
  pageSize: number
  total: number
  /** mis. "produk", "transaksi" */
  unitLabel: string
  onPage: (page: number) => void
  disabled?: boolean
}) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(total, page * pageSize)

  return (
    <div className="card__footer">
      <span className="text-xs text-muted-foreground">
        {total > 0 ? `Menampilkan ${first}–${last} dari ${total} ${unitLabel}` : `Tidak ada ${unitLabel}`}
        {totalPages > 1 ? ` · halaman ${page}/${totalPages}` : ''}
      </span>
      <nav className="ms-auto" aria-label={`Halaman ${unitLabel}`}>
        <ul className="pagination">
          <li>
            <button
              type="button"
              className="pagination__button"
              aria-label="Sebelumnya"
              aria-disabled={page <= 1 || disabled ? 'true' : undefined}
              disabled={page <= 1 || disabled}
              onClick={() => onPage(page - 1)}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
          </li>
          <li>
            <span className="pagination__button" data-state="active" aria-current="page">
              {page}
            </span>
          </li>
          <li>
            <button
              type="button"
              className="pagination__button"
              aria-label="Berikutnya"
              aria-disabled={page >= totalPages || disabled ? 'true' : undefined}
              disabled={page >= totalPages || disabled}
              onClick={() => onPage(page + 1)}
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </li>
        </ul>
      </nav>
    </div>
  )
}

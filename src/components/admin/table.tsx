import type { ReactNode } from 'react'

/**
 * Tabel Stisla v3 (`.table`) — hanya kerangka presentasi; logika kolom tetap
 * di halaman (TanStack Table) sesuai AGENTS.md §2.1 butir 4.
 */
export function AdminTable({
  head,
  children,
  className,
}: {
  head: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className="table-responsive">
      <table className={className ? `table table--hover table--align-middle ${className}` : 'table table--hover table--align-middle'}>
        <thead className="table__head--alt">
          <tr>{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

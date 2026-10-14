import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { flexRender, stockFeatures, useTable } from '@tanstack/react-table'
import { toast } from 'sonner'
import { adminOrdersOptions, exportAdminOrders } from '#/server/fn/admin'
import { formatDateTime, rupiah } from '#/lib/format'
import { ORDER_STATUS_LABEL, ORDER_TYPE_LABEL, orderStatusTone } from '#/lib/order-status'

export const Route = createFileRoute('/admin/transaksi/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(adminOrdersOptions(ORDER_LIST_PARAMS)),
  component: TransaksiListPage,
})

const ORDER_LIST_PARAMS = { status: 'all' as const, type: 'all' as const, page: 1 }

const STATUSES = [
  'all',
  'pending_payment',
  'paid',
  'processing',
  'awaiting_stock',
  'shipped',
  'ready_pickup',
  'completed',
  'rented',
  'returned',
  'cancelled',
  'refunded',
  'expired',
  'overdue',
] as const

const TONE_BADGE: Record<string, string> = {
  pending: 'badge-warning',
  success: 'badge-success',
  info: 'badge-info',
  destructive: 'badge-danger',
}

function TransaksiListPage() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string>(ORDER_LIST_PARAMS.status)
  const [type, setType] = useState<'all' | 'buy' | 'rent' | 'preorder'>(ORDER_LIST_PARAMS.type)
  const [page, setPage] = useState(ORDER_LIST_PARAMS.page)
  const params = {
    q: q || undefined,
    status,
    type,
    page,
  }
  const { data, isLoading } = useQuery(adminOrdersOptions(params))
  const exportFn = useServerFn(exportAdminOrders)
  const [exporting, setExporting] = useState(false)

  const downloadCsv = async () => {
    setExporting(true)
    try {
      const csv = await exportFn({ data: { q: q || undefined, status, type, page: 1 } })
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transaksi-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Gagal mengekspor CSV.')
    } finally {
      setExporting(false)
    }
  }

  const table = useTable({
    features: stockFeatures,
    data: data?.rows ?? [],
    columns: [
      {
        id: 'kode',
        header: () => <th>Kode</th>,
        cell: ({ row }) => (
          <Link to="/admin/transaksi/$id" params={{ id: row.original.id }} className="font-weight-bold">
            {row.original.code}
          </Link>
        ),
      },
      {
        id: 'pelanggan',
        header: () => <th>Pelanggan</th>,
        cell: ({ row }) => <span>{row.original.customer ?? 'Walk-in'}</span>,
      },
      {
        id: 'tipe',
        header: () => <th>Tipe</th>,
        cell: ({ row }) => (
          <span>
            {ORDER_TYPE_LABEL[row.original.type]} · {row.original.channel}
          </span>
        ),
      },
      {
        id: 'status',
        header: () => <th>Status</th>,
        cell: ({ row }) => (
          <span className={`badge ${TONE_BADGE[orderStatusTone(row.original.status)] ?? 'badge-secondary'}`}>
            {ORDER_STATUS_LABEL[row.original.status] ?? row.original.status}
          </span>
        ),
      },
      {
        id: 'total',
        header: () => <th className="text-right">Total</th>,
        cell: ({ row }) => <span>{rupiah(row.original.grandTotal)}</span>,
      },
      {
        id: 'dibuat',
        header: () => <th>Dibuat</th>,
        cell: ({ row }) => <span>{formatDateTime(row.original.createdAt)}</span>,
      },
    ],
  })

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <>
      <div className="section-header d-flex justify-content-between align-items-center">
        <h1>Transaksi</h1>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={exporting}
          onClick={() => void downloadCsv()}
        >
          <i className="fas fa-file-csv" /> {exporting ? 'Menyiapkan…' : 'Ekspor CSV'}
        </button>
      </div>
      <div className="section-body">
        <div className="card">
          <div className="card-body">
            <form
              className="form-inline mb-3"
              onSubmit={(e) => {
                e.preventDefault()
                setPage(1)
              }}
            >
              <input
                className="form-control mr-2 mb-2"
                style={{ maxWidth: 240 }}
                placeholder="Cari kode / pelanggan…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setPage(1)
                }}
              />
              <select
                className="form-control mr-2 mb-2"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value)
                  setPage(1)
                }}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === 'all' ? 'Semua status' : (ORDER_STATUS_LABEL[s] ?? s)}
                  </option>
                ))}
              </select>
              <select
                className="form-control mr-2 mb-2"
                value={type}
                onChange={(e) => {
                  setType(e.target.value as typeof type)
                  setPage(1)
                }}
              >
                <option value="all">Semua tipe</option>
                <option value="buy">Beli</option>
                <option value="rent">Sewa</option>
                <option value="preorder">Pre-order</option>
              </select>
            </form>

            <div className="table-responsive">
              <table className="table table-striped mb-0">
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((h) => (
                        <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {isLoading ? (
              <p className="text-muted text-center py-3">Memuat…</p>
            ) : data?.rows.length === 0 ? (
              <p className="text-muted text-center py-3">Tidak ada transaksi.</p>
            ) : null}

            <div className="d-flex justify-content-between align-items-center mt-3">
              <span className="text-muted text-sm">
                {data ? `${data.total} transaksi · halaman ${page}/${totalPages}` : ''}
              </span>
              <div>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary mr-1"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

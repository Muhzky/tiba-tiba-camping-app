import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { flexRender, stockFeatures, useTable } from '@tanstack/react-table'
import { toast } from 'sonner'
import { Download, ReceiptText } from 'lucide-react'
import { adminOrdersOptions, exportAdminOrders } from '#/server/fn/admin'
import { formatDateTime, rupiah } from '#/lib/format'
import { ORDER_STATUS_LABEL, ORDER_TYPE_LABEL } from '#/lib/order-status'
import { AdminPage } from '#/components/admin/page'
import { AdminCard } from '#/components/admin/card'
import { AdminTable } from '#/components/admin/table'
import { AdminPagination } from '#/components/admin/pagination'
import { OrderStatusBadge } from '#/components/admin/badge'
import { EmptyState } from '#/components/admin/empty'
import { SearchInput, SelectInput } from '#/components/admin/field'
import { buttonClass } from '#/components/admin/button'

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
  const { data, isLoading, isFetching } = useQuery(adminOrdersOptions(params))
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
        header: 'Kode',
        meta: { className: 'whitespace-nowrap' },
        cell: ({ row }) => (
          <Link
            to="/admin/transaksi/$id"
            params={{ id: row.original.id }}
            className="font-medium whitespace-nowrap"
          >
            {row.original.code}
          </Link>
        ),
      },
      {
        id: 'pelanggan',
        header: 'Pelanggan',
        cell: ({ row }) => <span>{row.original.customer ?? 'Walk-in'}</span>,
      },
      {
        id: 'tipe',
        header: 'Tipe',
        meta: { className: 'whitespace-nowrap' },
        cell: ({ row }) => (
          <span>
            {ORDER_TYPE_LABEL[row.original.type]} · {row.original.channel}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        meta: { className: 'whitespace-nowrap' },
        cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
      },
      {
        id: 'total',
        header: 'Total',
        meta: { className: 'text-right whitespace-nowrap' },
        cell: ({ row }) => <span className="font-medium">{rupiah(row.original.grandTotal)}</span>,
      },
      {
        id: 'dibuat',
        header: 'Dibuat',
        meta: { className: 'hidden whitespace-nowrap lg:table-cell' },
        cell: ({ row }) => (
          <span className="text-muted-foreground">{formatDateTime(row.original.createdAt)}</span>
        ),
      },
    ],
  })

  return (
    <AdminPage
      title="Transaksi"
      description="Riwayat order beli, sewa, dan pre-order beserta status pembayarannya."
      actions={
        <button
          type="button"
          className={buttonClass({ variant: 'neutral' })}
          disabled={exporting}
          onClick={() => void downloadCsv()}
        >
          <Download aria-hidden="true" />
          {exporting ? 'Menyiapkan…' : 'Ekspor CSV'}
        </button>
      }
    >
      <AdminCard
        headerAlt
        title={
          <span className="admin-toolbar-title">
            Daftar transaksi
            {data ? <span className="admin-toolbar-count">{data.total}</span> : null}
          </span>
        }
        actions={
          <form
            className="flex w-full flex-wrap items-center gap-2 md:w-auto"
            onSubmit={(e) => {
              e.preventDefault()
              setPage(1)
            }}
          >
            <SearchInput
              label="transaksi"
              placeholder="Cari kode / pelanggan…"
              className="w-full sm:w-60"
              value={q}
              onChange={(value) => {
                setQ(value)
                setPage(1)
              }}
            />
            <SelectInput
              ariaLabel="Filter status"
              className="w-full sm:w-48"
              value={status}
              onChange={(value) => {
                setStatus(value)
                setPage(1)
              }}
              options={STATUSES.map((s) => ({
                value: s,
                label: s === 'all' ? 'Semua status' : (ORDER_STATUS_LABEL[s] ?? s),
              }))}
            />
            <SelectInput
              ariaLabel="Filter tipe"
              className="w-full sm:w-40"
              value={type}
              onChange={(value) => {
                setType(value as typeof type)
                setPage(1)
              }}
              options={[
                { value: 'all', label: 'Semua tipe' },
                { value: 'buy', label: 'Beli' },
                { value: 'rent', label: 'Sewa' },
                { value: 'preorder', label: 'Pre-order' },
              ]}
            />
          </form>
        }
        bodyClassName="p-0"
      >
        <AdminTable
          className={isFetching && !isLoading ? 'admin-table--busy' : undefined}
          head={table.getHeaderGroups()[0]?.headers.map((h) => (
            <th key={h.id} className={h.column.columnDef.meta?.className}>
              {flexRender(h.column.columnDef.header, h.getContext())}
            </th>
          ))}
        >
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className={cell.column.columnDef.meta?.className}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </AdminTable>

        {isLoading ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Memuat transaksi…</p>
        ) : data?.rows.length === 0 ? (
          <div className="px-4 py-6">
            <EmptyState
              size="sm"
              icon={ReceiptText}
              title="Tidak ada transaksi"
              text="Coba ubah kata kunci atau filter status."
            />
          </div>
        ) : null}

        <AdminPagination
          page={page}
          pageSize={data?.pageSize ?? 20}
          total={data?.total ?? 0}
          unitLabel="transaksi"
          onPage={setPage}
          disabled={isLoading}
        />
      </AdminCard>
    </AdminPage>
  )
}

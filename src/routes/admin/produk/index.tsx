import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { flexRender, stockFeatures, useTable } from '@tanstack/react-table'
import {
  adminProductsOptions,
  duplicateProduct,
  toggleProductActive,
} from '#/server/fn/admin'
import { imageUrl } from '#/server/fn/product'
import { rupiah } from '#/lib/format'

export const Route = createFileRoute('/admin/produk/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(adminProductsOptions(PRODUCT_LIST_PARAMS)),
  component: ProdukListPage,
})

const PRODUCT_LIST_PARAMS = { status: 'all' as const, page: 1 }

function ProdukListPage() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(PRODUCT_LIST_PARAMS.page)
  const params = { q: q || undefined, status, page }
  const { data, isLoading } = useQuery(adminProductsOptions(params))
  const queryClient = useQueryClient()
  const dup = useServerFn(duplicateProduct)
  const toggle = useServerFn(toggleProductActive)

  const dupMutation = useMutation({
    mutationFn: (id: string) => dup({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'products'] })
    },
  })
  const toggleMutation = useMutation({
    mutationFn: (v: { id: string; isActive: boolean }) => toggle({ data: v }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'products'] })
    },
  })

  const table = useTable({
    features: stockFeatures,
    data: data?.rows ?? [],
    columns: [
      {
        id: 'gambar',
        header: () => <th>Gambar</th>,
        cell: ({ row }) =>
          row.original.imageKey ? (
            <img
              src={imageUrl(row.original.imageKey)}
              alt=""
              width={40}
              height={40}
              style={{ objectFit: 'cover', borderRadius: 6 }}
            />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: 6, background: '#eff2f5' }} />
          ),
      },
      {
        id: 'nama',
        header: () => <th>Nama</th>,
        cell: ({ row }) => (
          <>
            <div className="font-weight-bold">{row.original.name}</div>
            <div className="text-muted text-sm">{row.original.categoryName}</div>
          </>
        ),
      },
      {
        id: 'harga',
        header: () => <th className="text-right">Harga jual</th>,
        cell: ({ row }) => <span>{rupiah(row.original.salePrice)}</span>,
      },
      {
        id: 'sewa',
        header: () => <th className="text-right">Sewa/hari</th>,
        cell: ({ row }) => (
          <span>{row.original.rentPricePerDay ? rupiah(row.original.rentPricePerDay) : '—'}</span>
        ),
      },
      {
        id: 'varian',
        header: () => <th className="text-right">Varian / Stok</th>,
        cell: ({ row }) => <span>{row.original.variantCount} / {row.original.totalStock}</span>,
      },
      {
        id: 'status',
        header: () => <th>Status</th>,
        cell: ({ row }) => (
          <>
            <span className={`badge ${row.original.isActive ? 'badge-success' : 'badge-secondary'}`}>
              {row.original.isActive ? 'Aktif' : 'Nonaktif'}
            </span>{' '}
            {row.original.isPreorder ? <span className="badge badge-warning">PO</span> : null}{' '}
            {row.original.isRentable ? <span className="badge badge-info">Sewa</span> : null}
          </>
        ),
      },
      {
        id: 'aksi',
        header: () => <th className="text-right">Aksi</th>,
        cell: ({ row }) => (
          <div className="text-right">
            <Link
              to="/admin/produk/form"
              search={{ id: row.original.id }}
              className="btn btn-sm btn-primary mr-1"
            >
              Edit
            </Link>
            <button
              type="button"
              className="btn btn-sm btn-secondary mr-1"
              disabled={dupMutation.isPending}
              onClick={() => dupMutation.mutate(row.original.id)}
            >
              Duplikat
            </button>
            <button
              type="button"
              className={`btn btn-sm ${row.original.isActive ? 'btn-danger' : 'btn-success'}`}
              disabled={toggleMutation.isPending}
              onClick={() =>
                toggleMutation.mutate({ id: row.original.id, isActive: !row.original.isActive })
              }
            >
              {row.original.isActive ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
          </div>
        ),
      },
    ],
  })

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <>
      <div className="section-header d-flex justify-content-between align-items-center">
        <h1>Kelola Produk</h1>
        <Link to="/admin/produk/form" className="btn btn-primary">
          <i className="fas fa-plus" /> Tambah Produk
        </Link>
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
                style={{ maxWidth: 260 }}
                placeholder="Cari produk…"
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
                  setStatus(e.target.value as typeof status)
                  setPage(1)
                }}
              >
                <option value="all">Semua status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
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
              <p className="text-muted text-center py-3">Tidak ada produk.</p>
            ) : null}

            <div className="d-flex justify-content-between align-items-center mt-3">
              <span className="text-muted text-sm">
                {data ? `${data.total} produk · halaman ${page}/${totalPages}` : ''}
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

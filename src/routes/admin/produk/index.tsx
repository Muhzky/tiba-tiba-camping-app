import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { flexRender, stockFeatures, useTable } from '@tanstack/react-table'
import { Copy, Package, PackageSearch, Pencil, Plus, Power, PowerOff } from 'lucide-react'
import {
  adminProductsOptions,
  duplicateProduct,
  toggleProductActive,
} from '#/server/fn/admin'
import { imageUrl } from '#/server/fn/product'
import { rupiah } from '#/lib/format'
import { AdminPage } from '#/components/admin/page'
import { AdminCard } from '#/components/admin/card'
import { AdminTable } from '#/components/admin/table'
import { AdminPagination } from '#/components/admin/pagination'
import { StatusBadge } from '#/components/admin/badge'
import { EmptyState } from '#/components/admin/empty'
import { AdminButton, buttonClass } from '#/components/admin/button'
import { SearchInput, SelectInput } from '#/components/admin/field'

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
  const { data, isLoading, isFetching } = useQuery(adminProductsOptions(params))
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
        id: 'produk',
        header: 'Produk',
        meta: { className: 'admin-col-product' },
        cell: ({ row }) => {
          const { name, slug, categoryName, imageKey, id } = row.original
          return (
            <div className="admin-product">
              {imageKey ? (
                <img
                  src={imageUrl(imageKey)}
                  alt=""
                  width={48}
                  height={48}
                  loading="lazy"
                  className="admin-product__thumb"
                />
              ) : (
                <span className="admin-product__thumb admin-product__thumb--empty" aria-hidden="true">
                  <Package className="size-4" />
                </span>
              )}
              <div className="admin-product__body">
                <Link
                  to="/admin/produk/form"
                  search={{ id }}
                  title={name}
                  className="admin-product__name"
                >
                  {name}
                </Link>
                <div className="admin-product__meta">
                  <span className="admin-product__category">{categoryName}</span>
                  <span className="admin-product__slug" title={slug}>
                    {slug}
                  </span>
                </div>
              </div>
            </div>
          )
        },
      },
      {
        id: 'harga',
        header: 'Harga',
        meta: { className: 'admin-col-money' },
        cell: ({ row }) => (
          <div className="admin-money">
            <span className="admin-money__value">{rupiah(row.original.salePrice)}</span>
            <span className="admin-money__note">
              {row.original.rentPricePerDay
                ? `Sewa ${rupiah(row.original.rentPricePerDay)}/hari`
                : 'Tanpa sewa'}
            </span>
          </div>
        ),
      },
      {
        id: 'stok',
        header: 'Stok',
        meta: { className: 'admin-col-stock' },
        cell: ({ row }) => {
          const { totalStock: stock, variantCount } = row.original
          const level = stock === 0 ? 'out' : stock <= 3 ? 'low' : 'ok'
          return (
            <div className="admin-stock" data-level={level}>
              <div className="admin-stock__head">
                <span className="admin-stock__num">{stock}</span>
                <span className="admin-stock__unit">unit</span>
              </div>
              <span className="admin-stock__meter" aria-hidden="true">
                <span
                  className="admin-stock__fill"
                  style={{ width: `${Math.min(100, (stock / 20) * 100)}%` }}
                />
              </span>
              <span className="admin-stock__meta">
                {variantCount} varian
                {level === 'out' ? ' · habis' : level === 'low' ? ' · menipis' : ''}
              </span>
            </div>
          )
        },
      },
      {
        id: 'status',
        header: 'Status',
        meta: { className: 'admin-col-status' },
        cell: ({ row }) => (
          <div className="admin-status-stack">
            <StatusBadge tone={row.original.isActive ? 'success' : 'neutral'}>
              {row.original.isActive ? 'Aktif' : 'Nonaktif'}
            </StatusBadge>
            <div className="admin-status-stack__row">
              {row.original.isPreorder ? <StatusBadge tone="warning">PO</StatusBadge> : null}
              {row.original.isRentable ? <StatusBadge tone="info">Sewa</StatusBadge> : null}
              {!row.original.isPreorder && !row.original.isRentable ? (
                <span className="admin-cell-meta">Beli</span>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        id: 'aksi',
        header: 'Aksi',
        meta: { className: 'admin-col-actions' },
        cell: ({ row }) => (
          <div className="admin-row-actions">
            <Link
              to="/admin/produk/form"
              search={{ id: row.original.id }}
              className={buttonClass({ variant: 'outline', size: 'sm' })}
            >
              <Pencil aria-hidden="true" />
              Edit
            </Link>
            <AdminButton
              size="sm"
              variant="ghost"
              iconOnly
              title={`Duplikat ${row.original.name}`}
              aria-label={`Duplikat ${row.original.name}`}
              disabled={dupMutation.isPending}
              onClick={() => dupMutation.mutate(row.original.id)}
            >
              <Copy aria-hidden="true" />
            </AdminButton>
            <AdminButton
              size="sm"
              variant="ghost"
              iconOnly
              title={
                row.original.isActive
                  ? `Nonaktifkan ${row.original.name}`
                  : `Aktifkan ${row.original.name}`
              }
              aria-label={
                row.original.isActive
                  ? `Nonaktifkan ${row.original.name}`
                  : `Aktifkan ${row.original.name}`
              }
              disabled={toggleMutation.isPending}
              onClick={() =>
                toggleMutation.mutate({ id: row.original.id, isActive: !row.original.isActive })
              }
            >
              {row.original.isActive ? (
                <PowerOff aria-hidden="true" />
              ) : (
                <Power aria-hidden="true" />
              )}
            </AdminButton>
          </div>
        ),
      },
    ],
  })

  const kosong = !isLoading && (data?.rows.length ?? 0) === 0

  return (
    <AdminPage
      title="Kelola Produk"
      description="Katalog jual, sewa, dan preorder — atur harga, stok, dan varian."
      actions={
        <Link to="/admin/produk/form" className={buttonClass({ variant: 'primary' })}>
          <Plus aria-hidden="true" />
          Tambah Produk
        </Link>
      }
    >
      <AdminCard
        headerAlt
        title={
          <span className="admin-toolbar-title">
            Daftar produk
            {data ? <span className="admin-toolbar-count">{data.total}</span> : null}
          </span>
        }
        actions={
          <>
            <SearchInput
              label="produk"
              placeholder="Cari produk…"
              value={q}
              onChange={(value) => {
                setQ(value)
                setPage(1)
              }}
              className="w-full md:w-64"
            />
            <SelectInput
              ariaLabel="Filter status"
              value={status}
              onChange={(value) => {
                setStatus(value as typeof status)
                setPage(1)
              }}
              className="md:w-44"
              options={[
                { value: 'all', label: 'Semua status' },
                { value: 'active', label: 'Aktif' },
                { value: 'inactive', label: 'Nonaktif' },
              ]}
            />
          </>
        }
        bodyClassName="p-0"
      >
        {kosong ? (
          <div className="px-4 py-6">
            <EmptyState
              icon={PackageSearch}
              title="Tidak ada produk"
              text={
                q || status !== 'all'
                  ? 'Coba ubah kata kunci atau filter status.'
                  : 'Mulai dengan menambahkan produk pertama Anda.'
              }
              action={
                !q && status === 'all' ? (
                  <Link to="/admin/produk/form" className={buttonClass({ variant: 'primary' })}>
                    <Plus aria-hidden="true" />
                    Tambah Produk
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <AdminTable
            className={isFetching && !isLoading ? 'admin-table--busy' : undefined}
            head={table.getHeaderGroups().map((hg) =>
              hg.headers.map((h) => (
                <th
                  key={h.id}
                  scope="col"
                  className={h.column.columnDef.meta?.className}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              )),
            )}
          >
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cell.column.columnDef.meta?.className}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </AdminTable>
        )}
        <AdminPagination
          page={page}
          pageSize={data?.pageSize ?? 10}
          total={data?.total ?? 0}
          unitLabel="produk"
          onPage={setPage}
          disabled={isLoading}
        />
      </AdminCard>
    </AdminPage>
  )
}

import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { flexRender, stockFeatures, useTable } from '@tanstack/react-table'
import { Copy, PackageSearch, Pencil, Plus } from 'lucide-react'
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
        header: 'Gambar',
        cell: ({ row }) =>
          row.original.imageKey ? (
            <img
              src={imageUrl(row.original.imageKey)}
              alt=""
              width={40}
              height={40}
              className="rounded-md object-cover"
            />
          ) : (
            <div className="h-10 w-10 rounded-md bg-surface-2" />
          ),
      },
      {
        id: 'nama',
        header: 'Nama',
        cell: ({ row }) => (
          <>
            <div className="font-semibold">{row.original.name}</div>
            <div className="text-sm text-muted-foreground">{row.original.categoryName}</div>
          </>
        ),
      },
      {
        id: 'harga',
        header: 'Harga jual',
        meta: { className: 'text-right' },
        cell: ({ row }) => <span>{rupiah(row.original.salePrice)}</span>,
      },
      {
        id: 'sewa',
        header: 'Sewa/hari',
        meta: { className: 'text-right' },
        cell: ({ row }) => (
          <span>{row.original.rentPricePerDay ? rupiah(row.original.rentPricePerDay) : '—'}</span>
        ),
      },
      {
        id: 'varian',
        header: 'Varian / Stok',
        meta: { className: 'text-right' },
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.variantCount} / {row.original.totalStock}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            <StatusBadge tone={row.original.isActive ? 'success' : 'neutral'}>
              {row.original.isActive ? 'Aktif' : 'Nonaktif'}
            </StatusBadge>
            {row.original.isPreorder ? <StatusBadge tone="warning">PO</StatusBadge> : null}
            {row.original.isRentable ? <StatusBadge tone="info">Sewa</StatusBadge> : null}
          </div>
        ),
      },
      {
        id: 'aksi',
        header: 'Aksi',
        meta: { className: 'text-right' },
        cell: ({ row }) => (
          <div className="flex flex-wrap justify-end gap-1">
            <Link
              to="/admin/produk/form"
              search={{ id: row.original.id }}
              className={buttonClass({ variant: 'primary', size: 'sm' })}
            >
              <Pencil aria-hidden="true" />
              Edit
            </Link>
            <AdminButton
              size="sm"
              iconOnly
              aria-label={`Duplikat ${row.original.name}`}
              disabled={dupMutation.isPending}
              onClick={() => dupMutation.mutate(row.original.id)}
            >
              <Copy aria-hidden="true" />
            </AdminButton>
            <AdminButton
              size="sm"
              variant="outline"
              disabled={toggleMutation.isPending}
              onClick={() =>
                toggleMutation.mutate({ id: row.original.id, isActive: !row.original.isActive })
              }
            >
              {row.original.isActive ? 'Nonaktifkan' : 'Aktifkan'}
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
        footer={
          <AdminPagination
            page={page}
            pageSize={data?.pageSize ?? 10}
            total={data?.total ?? 0}
            unitLabel="produk"
            onPage={setPage}
            disabled={isLoading}
          />
        }
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
      </AdminCard>
    </AdminPage>
  )
}

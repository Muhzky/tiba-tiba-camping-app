import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, Power, PowerOff, Trash2, Users } from 'lucide-react'
import {
  adminUsersOptions,
  deleteUser,
  resetUserPassword,
  setUserActive,
  setUserRole,
} from '#/server/fn/admin'
import { meOptions } from '#/server/fn/auth'
import { formatDateTime, rupiah } from '#/lib/format'
import { AdminPage } from '#/components/admin/page'
import { AdminCard } from '#/components/admin/card'
import { AdminTable } from '#/components/admin/table'
import { AdminPagination } from '#/components/admin/pagination'
import { StatusBadge } from '#/components/admin/badge'
import { Field, SearchInput } from '#/components/admin/field'
import { AdminButton, buttonClass } from '#/components/admin/button'
import { EmptyState } from '#/components/admin/empty'

export const Route = createFileRoute('/admin/pengguna/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(adminUsersOptions({ page: 1 })),
  component: PenggunaPage,
})

const ROLE_LABEL: Record<string, string> = {
  customer: 'Pelanggan',
  admin: 'Admin',
}

function errorText(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  if (raw.includes('AKSES_DITOLAK'))
    return 'Akses ditolak. Silakan masuk ulang sebagai admin.'
  if (raw.includes('TIDAK_BISA_UBAH_DIRI_SENDIRI'))
    return 'Tidak bisa mengubah akunmu sendiri.'
  if (raw.includes('ADMIN_TERAKHIR'))
    return 'Akun admin ini tidak bisa dihapus karena satu-satunya admin.'
  if (raw.includes('USER_TIDAK_DITEMUKAN'))
    return 'Pengguna sudah tidak ada. Muat ulang daftar.'
  return 'Gagal. Coba lagi.'
}

function PenggunaPage() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [resetFor, setResetFor] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [deleteFor, setDeleteFor] = useState<string | null>(null)

  const { data, isFetching } = useQuery(adminUsersOptions({ q: q || undefined, page }))
  const me = useQuery(meOptions).data
  const queryClient = useQueryClient()

  const activeFn = useServerFn(setUserActive)
  const roleFn = useServerFn(setUserRole)
  const resetFn = useServerFn(resetUserPassword)
  const deleteFn = useServerFn(deleteUser)

  const isAdmin = me?.role === 'admin'
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
  }

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try {
      await fn()
      await invalidate()
      toast.success(ok)
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminPage
      title="Pengguna"
      description="Kelola akun, peran, dan status pengguna toko."
    >
      <AdminCard
        headerAlt
        title={
          <span className="admin-toolbar-title">
            Daftar pengguna
            {data ? <span className="admin-toolbar-count">{data.total}</span> : null}
          </span>
        }
        actions={
          <SearchInput
            label="pengguna"
            placeholder="Cari nama…"
            className="w-full md:w-64"
            value={q}
            onChange={(value) => {
              setQ(value)
              setPage(1)
            }}
          />
        }
        bodyClassName="p-0"
      >
        <AdminTable
          className={isFetching ? 'admin-table--busy' : undefined}
          head={
            <>
              <th scope="col">Pengguna</th>
              <th scope="col">Peran</th>
              <th scope="col">Status</th>
              <th scope="col" className="text-right whitespace-nowrap">
                Pesanan
              </th>
              <th scope="col" className="text-right whitespace-nowrap">
                Total belanja
              </th>
              <th scope="col" className="whitespace-nowrap">
                Terdaftar
              </th>
              <th scope="col" className="text-right">
                Aksi
              </th>
            </>
          }
        >
          {(data?.rows ?? []).map((u) => (
            <tr key={u.id}>
              <td>
                <div className="font-medium">{u.name}</div>
                <div className="admin-cell-meta">{u.email}</div>
              </td>
              <td>
                <select
                  className="select w-32"
                  value={u.role}
                  aria-label={`Peran ${u.name}`}
                  disabled={busy || !isAdmin || me.id === u.id}
                  onChange={(e) =>
                    void run(
                      () => roleFn({ data: { userId: u.id, role: e.target.value as 'customer' | 'admin' } }),
                      `Peran ${u.name} → ${ROLE_LABEL[e.target.value]}`,
                    )
                  }
                >
                  <option value="customer">{ROLE_LABEL.customer}</option>
                  <option value="admin">{ROLE_LABEL.admin}</option>
                </select>
              </td>
              <td>
                <StatusBadge tone={u.isActive ? 'success' : 'danger'}>
                  {u.isActive ? 'Aktif' : 'Nonaktif'}
                </StatusBadge>
              </td>
              <td className="text-right">{u.orderCount}</td>
              <td className="text-right font-medium">{rupiah(u.totalSpent)}</td>
              <td className="whitespace-nowrap text-muted-foreground">
                {formatDateTime(u.createdAt)}
              </td>
              <td className="whitespace-nowrap">
                <div className="admin-row-actions">
                  <AdminButton
                    size="sm"
                    variant="ghost"
                    iconOnly
                    title={u.isActive ? `Nonaktifkan ${u.name}` : `Aktifkan ${u.name}`}
                    aria-label={u.isActive ? `Nonaktifkan ${u.name}` : `Aktifkan ${u.name}`}
                    disabled={busy || me?.id === u.id}
                    onClick={() =>
                      void run(
                        () => activeFn({ data: { userId: u.id, isActive: !u.isActive } }),
                        u.isActive ? `${u.name} dinonaktifkan` : `${u.name} diaktifkan`,
                      )
                    }
                  >
                    {u.isActive ? <PowerOff aria-hidden="true" /> : <Power aria-hidden="true" />}
                  </AdminButton>
                  <AdminButton
                    size="sm"
                    variant="ghost"
                    iconOnly
                    title={`Reset password ${u.name}`}
                    aria-label={`Reset password ${u.name}`}
                    disabled={busy}
                    onClick={() => {
                      setResetFor(resetFor === u.id ? null : u.id)
                      setDeleteFor(null)
                      setNewPassword('')
                    }}
                  >
                    <KeyRound aria-hidden="true" />
                  </AdminButton>
                  <AdminButton
                    size="sm"
                    variant="ghost"
                    iconOnly
                    className="text-danger"
                    title={`Hapus ${u.name}`}
                    aria-label={`Hapus ${u.name}`}
                    disabled={busy || me?.id === u.id}
                    onClick={() => {
                      setDeleteFor(deleteFor === u.id ? null : u.id)
                      setResetFor(null)
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                  </AdminButton>
                </div>
              </td>
            </tr>
          ))}
          {resetFor ? (
            <tr>
              <td colSpan={7} className="bg-surface-2">
                <form
                  className="flex max-w-xl flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void run(async () => {
                      await resetFn({ data: { userId: resetFor, password: newPassword } })
                      setResetFor(null)
                      setNewPassword('')
                    }, 'Password direset.')
                  }}
                >
                  <Field className="mb-0 flex-1" label="Password baru" htmlFor="reset-password">
                    <input
                      id="reset-password"
                      className="input"
                      type="password"
                      minLength={8}
                      required
                      placeholder="min 8 karakter"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </Field>
                  <button
                    type="submit"
                    className={buttonClass({ variant: 'primary', size: 'sm' })}
                  >
                    Simpan
                  </button>
                  <AdminButton size="sm" variant="ghost" onClick={() => setResetFor(null)}>
                    Batal
                  </AdminButton>
                </form>
              </td>
            </tr>
          ) : null}
          {deleteFor ? (
            <tr>
              <td colSpan={7} className="bg-surface-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm">
                    Hapus{' '}
                    <strong className="font-semibold">
                      {(data?.rows ?? []).find((u) => u.id === deleteFor)?.name ?? 'pengguna ini'}
                    </strong>
                    ? Sesi login dan keranjangnya ikut terhapus; riwayat pesanan tetap tersimpan.
                  </span>
                  <div className="admin-row-actions">
                    <AdminButton
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setDeleteFor(null)}
                    >
                      Batal
                    </AdminButton>
                    <button
                      type="button"
                      className={buttonClass({ variant: 'danger', size: 'sm' })}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await deleteFn({ data: { userId: deleteFor } })
                          setDeleteFor(null)
                        }, 'Pengguna dihapus.')
                      }
                    >
                      Ya, hapus
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          ) : null}
          {data && data.rows.length === 0 ? (
            <tr>
              <td colSpan={7}>
                <EmptyState icon={Users} title="Tidak ada pengguna" text="Coba ubah kata kunci pencarian." />
              </td>
            </tr>
          ) : null}
        </AdminTable>

        <AdminPagination
          page={page}
          pageSize={data?.pageSize ?? 20}
          total={data?.total ?? 0}
          unitLabel="pengguna"
          onPage={setPage}
        />
      </AdminCard>
    </AdminPage>
  )
}

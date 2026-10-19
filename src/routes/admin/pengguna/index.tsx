import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { toast } from 'sonner'
import { KeyRound } from 'lucide-react'
import {
  adminUsersOptions,
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
  owner: 'Owner',
}

function PenggunaPage() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [resetFor, setResetFor] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const { data } = useQuery(adminUsersOptions({ q: q || undefined, page }))
  const me = useQuery(meOptions).data
  const queryClient = useQueryClient()

  const activeFn = useServerFn(setUserActive)
  const roleFn = useServerFn(setUserRole)
  const resetFn = useServerFn(resetUserPassword)

  const isOwner = me?.role === 'owner'
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
      toast.error(err instanceof Error ? err.message : 'Gagal.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminPage
      title="Pengguna"
      description="Kelola akun, peran, dan status pengguna toko."
    >
      <AdminCard bodyClassName="p-0">
        <div className="p-4">
          <SearchInput
            label="pengguna"
            placeholder="Cari nama…"
            className="max-w-xs"
            value={q}
            onChange={(value) => {
              setQ(value)
              setPage(1)
            }}
          />
        </div>

        <AdminTable
          head={
            <>
              <th scope="col">Nama</th>
              <th scope="col">Email</th>
              <th scope="col">Peran</th>
              <th scope="col">Status</th>
              <th scope="col" className="text-right">
                Pesanan
              </th>
              <th scope="col" className="text-right">
                Total belanja
              </th>
              <th scope="col">Terdaftar</th>
              <th scope="col" className="text-right">
                Aksi
              </th>
            </>
          }
        >
          {(data?.rows ?? []).map((u) => (
            <tr key={u.id}>
              <td className="font-semibold">{u.name}</td>
              <td>{u.email}</td>
              <td>
                <select
                  className="select max-w-[7.5rem]"
                  value={u.role}
                  aria-label={`Peran ${u.name}`}
                  disabled={busy || !isOwner || me.id === u.id}
                  onChange={(e) =>
                    void run(
                      () => roleFn({ data: { userId: u.id, role: e.target.value as 'customer' | 'admin' | 'owner' } }),
                      `Peran ${u.name} → ${ROLE_LABEL[e.target.value]}`,
                    )
                  }
                >
                  <option value="customer">{ROLE_LABEL.customer}</option>
                  <option value="admin">{ROLE_LABEL.admin}</option>
                  <option value="owner">{ROLE_LABEL.owner}</option>
                </select>
              </td>
              <td>
                <StatusBadge tone={u.isActive ? 'success' : 'danger'}>
                  {u.isActive ? 'Aktif' : 'Nonaktif'}
                </StatusBadge>
              </td>
              <td className="text-right">{u.orderCount}</td>
              <td className="text-right">{rupiah(u.totalSpent)}</td>
              <td>{formatDateTime(u.createdAt)}</td>
              <td>
                <div className="flex flex-wrap justify-end gap-1">
                  <AdminButton
                    size="sm"
                    variant={u.isActive ? 'outline' : 'primary'}
                    disabled={busy || me?.id === u.id}
                    onClick={() =>
                      void run(
                        () => activeFn({ data: { userId: u.id, isActive: !u.isActive } }),
                        u.isActive ? `${u.name} dinonaktifkan` : `${u.name} diaktifkan`,
                      )
                    }
                  >
                    {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  </AdminButton>
                  <AdminButton
                    size="sm"
                    variant="neutral"
                    disabled={busy}
                    onClick={() => {
                      setResetFor(resetFor === u.id ? null : u.id)
                      setNewPassword('')
                    }}
                  >
                    <KeyRound aria-hidden="true" />
                    Reset password
                  </AdminButton>
                </div>
              </td>
            </tr>
          ))}
          {resetFor ? (
            <tr>
              <td colSpan={8}>
                <form
                  className="flex flex-wrap items-end gap-2"
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
          {(data?.rows ?? []).length === 0 ? (
            <tr>
              <td colSpan={8}>
                <EmptyState icon={KeyRound} title="Tidak ada pengguna" text="Coba ubah kata kunci pencarian." />
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

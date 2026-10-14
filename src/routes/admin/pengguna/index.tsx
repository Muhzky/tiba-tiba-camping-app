import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  adminUsersOptions,
  resetUserPassword,
  setUserActive,
  setUserRole,
} from '#/server/fn/admin'
import { meOptions } from '#/server/fn/auth'
import { formatDateTime, rupiah } from '#/lib/format'

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

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <>
      <div className="section-header">
        <h1>Pengguna</h1>
      </div>
      <div className="section-body">
        <div className="card">
          <div className="card-body">
            <input
              className="form-control mb-3"
              style={{ maxWidth: 300 }}
              placeholder="Cari nama…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
            />
            <div className="table-responsive">
              <table className="table table-striped mb-0">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Email</th>
                    <th>Peran</th>
                    <th>Status</th>
                    <th className="text-right">Pesanan</th>
                    <th className="text-right">Total belanja</th>
                    <th>Terdaftar</th>
                    <th className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.rows ?? []).map((u) => (
                    <tr key={u.id}>
                      <td className="font-weight-bold">{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <select
                          className="form-control form-control-sm"
                          style={{ width: 120 }}
                          value={u.role}
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
                        <span className={`badge ${u.isActive ? 'badge-success' : 'badge-danger'}`}>
                          {u.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="text-right">{u.orderCount}</td>
                      <td className="text-right">{rupiah(u.totalSpent)}</td>
                      <td>{formatDateTime(u.createdAt)}</td>
                      <td className="text-right">
                        <button
                          type="button"
                          className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-success'} mr-1`}
                          disabled={busy || me?.id === u.id}
                          onClick={() =>
                            void run(
                              () => activeFn({ data: { userId: u.id, isActive: !u.isActive } }),
                              u.isActive ? `${u.name} dinonaktifkan` : `${u.name} diaktifkan`,
                            )
                          }
                        >
                          {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          disabled={busy}
                          onClick={() => {
                            setResetFor(resetFor === u.id ? null : u.id)
                            setNewPassword('')
                          }}
                        >
                          Reset password
                        </button>
                      </td>
                    </tr>
                  ))}
                  {resetFor ? (
                    <tr>
                      <td colSpan={8}>
                        <form
                          className="form-inline"
                          onSubmit={(e) => {
                            e.preventDefault()
                            void run(async () => {
                              await resetFn({ data: { userId: resetFor, password: newPassword } })
                              setResetFor(null)
                              setNewPassword('')
                            }, 'Password direset.')
                          }}
                        >
                          <input
                            className="form-control form-control-sm mr-2"
                            type="password"
                            minLength={8}
                            required
                            placeholder="Password baru (min 8)"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                          />
                          <button type="submit" className="btn btn-sm btn-primary mr-2">
                            Simpan
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => setResetFor(null)}
                          >
                            Batal
                          </button>
                        </form>
                      </td>
                    </tr>
                  ) : null}
                  {(data?.rows ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center text-muted">
                        Tidak ada pengguna.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="d-flex justify-content-between align-items-center mt-3">
              <span className="text-muted text-sm">
                {data ? `${data.total} pengguna · halaman ${page}/${totalPages}` : ''}
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

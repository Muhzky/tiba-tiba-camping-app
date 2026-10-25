import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Printer } from 'lucide-react'
import {
  adminOrderDetailOptions,
  isReturnableRentalStatus,
  returnRental,
  updateOrderStatus,
} from '#/server/fn/admin'
import { formatDate, formatDateTime, rupiah } from '#/lib/format'
import { rentalDeadlineInfo } from '#/lib/order-totals'
import { ORDER_STATUS_LABEL, ORDER_TYPE_LABEL, customerLabel } from '#/lib/order-status'
import { AdminPage } from '#/components/admin/page'
import { AdminCard } from '#/components/admin/card'
import { AdminTable } from '#/components/admin/table'
import { OrderStatusBadge, StatusBadge } from '#/components/admin/badge'
import { Field, SelectInput } from '#/components/admin/field'
import { buttonClass } from '#/components/admin/button'

type PaymentTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const PAYMENT_LABEL: Record<string, { label: string; tone: PaymentTone }> = {
  settlement: { label: 'Lunas', tone: 'success' },
  capture: { label: 'Lunas', tone: 'success' },
  paid: { label: 'Lunas', tone: 'success' },
  pending: { label: 'Menunggu', tone: 'warning' },
  refund: { label: 'Refund', tone: 'info' },
  deny: { label: 'Ditolak', tone: 'danger' },
  cancel: { label: 'Dibatalkan', tone: 'danger' },
  expire: { label: 'Kedaluwarsa', tone: 'danger' },
  failure: { label: 'Gagal', tone: 'danger' },
}

export const Route = createFileRoute('/admin/transaksi/$id')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(adminOrderDetailOptions(params.id)),
  component: TransaksiDetailPage,
})

function TransaksiDetailPage() {
  const { id } = Route.useParams()
  const initial = Route.useLoaderData()
  const { data: detail } = useQuery({
    ...adminOrderDetailOptions(id),
    initialData: initial,
  })
  const queryClient = useQueryClient()
  const updateFn = useServerFn(updateOrderStatus)
  const returnFn = useServerFn(returnRental)

  const order = detail.order
  const [target, setTarget] = useState<string>('')
  const [note, setNote] = useState('')
  const [trackingNo, setTrackingNo] = useState(order.trackingNo ?? '')
  const [busy, setBusy] = useState(false)

  const deadline = rentalDeadlineInfo(detail.items.map((item) => item.rentEnd))
  const dailyRate = detail.items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0)
  const initialLateFee = deadline.lateDays * dailyRate
  const finished = ['completed', 'returned', 'cancelled', 'refunded', 'expired'].includes(
    order.status,
  )

  const [ret, setRet] = useState({
    lateDays: String(deadline.lateDays),
    lateFee: String(initialLateFee),
    damageFee: '0',
    depositRefund: String(Math.max(0, order.depositTotal - initialLateFee)),
    conditionNote: '',
  })

  const refundFor = (lateFee: string, damageFee: string) =>
    String(
      Math.max(
        0,
        order.depositTotal - (Number(lateFee) || 0) - (Number(damageFee) || 0),
      ),
    )

  const updateLateDays = (value: string) => {
    const days = Math.max(0, Number(value) || 0)
    const fee = String(days * dailyRate)
    setRet((prev) => ({
      ...prev,
      lateDays: value,
      lateFee: fee,
      depositRefund: refundFor(fee, prev.damageFee),
    }))
  }

  const updateFee = (key: 'lateFee' | 'damageFee', value: string) => {
    setRet((prev) => {
      const next = { ...prev, [key]: value }
      return { ...next, depositRefund: refundFor(next.lateFee, next.damageFee) }
    })
  }

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: adminOrderDetailOptions(id).queryKey })
    await queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
    await queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] })
  }

  const applyStatus = async () => {
    if (!target) return
    setBusy(true)
    try {
      await updateFn({
        data: {
          orderId: id,
          to: target as 'paid',
          note: note || undefined,
          trackingNo: target === 'shipped' ? trackingNo : undefined,
        },
      })
      await invalidate()
      setTarget('')
      setNote('')
      toast.success('Status diperbarui.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memperbarui status.')
    } finally {
      setBusy(false)
    }
  }

  const submitReturn = async () => {
    setBusy(true)
    try {
      await returnFn({
        data: {
          orderId: id,
          lateDays: Math.max(0, Number(ret.lateDays) || 0),
          lateFee: Math.max(0, Number(ret.lateFee) || 0),
          damageFee: Math.max(0, Number(ret.damageFee) || 0),
          depositRefund: Math.max(0, Number(ret.depositRefund) || 0),
          conditionNote: ret.conditionNote || undefined,
        },
      })
      await invalidate()
      toast.success('Pengembalian sewa dicatat.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mencatat pengembalian.')
    } finally {
      setBusy(false)
    }
  }

  const canReturn =
    order.type === 'rent' &&
    isReturnableRentalStatus(order.status) &&
    detail.returns.length === 0

  return (
    <AdminPage
      title={order.code}
      description={`${ORDER_TYPE_LABEL[order.type]} · ${order.channel}`}
      breadcrumb={[{ label: 'Transaksi', to: '/admin/transaksi' }, { label: order.code }]}
      actions={
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <Link
            to="/struk/$code"
            params={{ code: order.code }}
            className={buttonClass({ variant: 'neutral' })}
          >
            <Printer aria-hidden="true" />
            Struk
          </Link>
          <Link to="/admin/transaksi" className={buttonClass({ variant: 'ghost' })}>
            <ArrowLeft aria-hidden="true" />
            Kembali
          </Link>
        </div>
      }
    >
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <div className="flex flex-col gap-4 xl:col-span-8">
          <AdminCard title="Item" bodyClassName="p-0">
            <AdminTable
              head={
                <>
                  <th scope="col">Produk</th>
                  <th scope="col">Serial</th>
                  <th scope="col">Periode sewa</th>
                  <th scope="col" className="text-right">
                    Qty
                  </th>
                  <th scope="col" className="text-right whitespace-nowrap">
                    Harga satuan
                  </th>
                </>
              }
            >
              {detail.items.map((it) => (
                <tr key={it.id}>
                  <td className="font-medium">{it.name}</td>
                  <td className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {it.rentalUnitSerial ?? '—'}
                  </td>
                  <td>
                    {it.rentStart && it.rentEnd ? (
                      <>
                        <div>
                          {formatDate(it.rentStart)} → {formatDate(it.rentEnd)}
                        </div>
                        <div className="admin-cell-meta">{it.rentDays} hari</div>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="text-right">{it.qty}</td>
                  <td className="text-right whitespace-nowrap font-medium">{rupiah(it.unitPrice)}</td>
                </tr>
              ))}
            </AdminTable>
          </AdminCard>

          <AdminCard title="Riwayat status">
            {detail.logs.length === 0 ? (
              <p className="text-muted-foreground">Belum ada riwayat.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {detail.logs.map((log) => (
                  <li key={log.id} className="flex flex-wrap items-center gap-2">
                    <OrderStatusBadge status={log.toStatus} />
                    <span className="text-sm">
                      {log.fromStatus ? ORDER_STATUS_LABEL[log.fromStatus] : 'Mulai'} →{' '}
                      {ORDER_STATUS_LABEL[log.toStatus]}
                    </span>
                    <small className="text-muted-foreground">{formatDateTime(log.createdAt)}</small>
                    {log.note ? (
                      <p className="w-full text-sm text-muted-foreground">{log.note}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard title="Pembayaran" bodyClassName={detail.payments.length === 0 ? undefined : 'p-0'}>
            {detail.payments.length === 0 ? (
              <p className="text-muted-foreground">Belum ada pembayaran.</p>
            ) : (
              <AdminTable
                head={
                  <>
                    <th scope="col">Provider</th>
                    <th scope="col" className="text-right whitespace-nowrap">
                      Jumlah
                    </th>
                    <th scope="col">Status</th>
                    <th scope="col">Signature</th>
                    <th scope="col" className="whitespace-nowrap">
                      Waktu
                    </th>
                  </>
                }
              >
                {detail.payments.map((pay) => {
                  const badge =
                    PAYMENT_LABEL[pay.status] ?? { label: pay.status, tone: 'neutral' as const }
                  return (
                    <tr key={pay.id}>
                      <td className="capitalize">{pay.provider}</td>
                      <td className="text-right whitespace-nowrap font-medium">
                        {rupiah(pay.grossAmount)}
                      </td>
                      <td>
                        <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                      </td>
                      <td className={pay.signatureValid ? 'admin-signature--ok' : 'admin-signature--bad'}>
                        {pay.signatureValid ? '✓' : '✗'}
                      </td>
                      <td className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(pay.createdAt)}
                      </td>
                    </tr>
                  )
                })}
              </AdminTable>
            )}
          </AdminCard>

          {canReturn ? (
            <AdminCard title="Pengembalian sewa">
              <div className="mb-3 rounded-xl bg-surface px-3 py-2 text-sm">
                <p>
                  Tenggat sewa:{' '}
                  <strong>{deadline.deadline ? formatDate(deadline.deadline) : '—'}</strong>
                </p>
                <p className="text-muted-foreground">
                  {deadline.lateDays > 0
                    ? `Terlambat ${deadline.lateDays} hari · tarif ${rupiah(dailyRate)}/hari`
                    : `Masih dalam masa sewa · tarif denda ${rupiah(dailyRate)}/hari`}
                </p>
                <p className="text-muted-foreground">
                  Deposit diterima {rupiah(order.depositTotal)}. Deposit kembali dihitung otomatis
                  dari deposit dikurangi denda.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                <Field label="Telat (hari)" className="md:col-span-1">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={ret.lateDays}
                    onChange={(e) => updateLateDays(e.target.value)}
                  />
                </Field>
                <Field label="Denda telat" className="md:col-span-1">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={ret.lateFee}
                    onChange={(e) => updateFee('lateFee', e.target.value)}
                  />
                </Field>
                <Field label="Denda rusak" className="md:col-span-1">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={ret.damageFee}
                    onChange={(e) => updateFee('damageFee', e.target.value)}
                  />
                </Field>
                <Field label="Deposit kembali" className="md:col-span-1">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={ret.depositRefund}
                    onChange={(e) => setRet({ ...ret, depositRefund: e.target.value })}
                  />
                </Field>
                <Field label="Kondisi saat kembali" className="col-span-2 md:col-span-2">
                  <input
                    className="input"
                    value={ret.conditionNote}
                    onChange={(e) => setRet({ ...ret, conditionNote: e.target.value })}
                  />
                </Field>
              </div>
              <button
                type="button"
                className={buttonClass({ variant: 'primary' })}
                disabled={busy}
                onClick={() => void submitReturn()}
              >
                Catat pengembalian &amp; selesaikan
              </button>
            </AdminCard>
          ) : null}

          {order.type === 'rent' && order.returnedAt ? (
            <AdminCard title="Pengembalian">
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Dikembalikan</dt>
                  <dd className="text-right">{formatDateTime(order.returnedAt)}</dd>
                </div>
                {order.lateDays > 0 ? (
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">Telat</dt>
                    <dd className="text-right">{order.lateDays} hari</dd>
                  </div>
                ) : null}
                {order.lateFee > 0 ? (
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">Denda telat</dt>
                    <dd className="text-right tabular-nums">{rupiah(order.lateFee)}</dd>
                  </div>
                ) : null}
                {order.damageFee > 0 ? (
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">Denda kerusakan</dt>
                    <dd className="text-right tabular-nums">{rupiah(order.damageFee)}</dd>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-4 border-t border-border pt-2">
                  <dt className="font-medium">Deposit kembali</dt>
                  <dd className="text-right font-semibold tabular-nums">
                    {rupiah(order.depositRefunded)}
                  </dd>
                </div>
              </dl>
              {detail.returns[0]?.conditionNote ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Kondisi: {detail.returns[0].conditionNote}
                </p>
              ) : null}
            </AdminCard>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 xl:col-span-4">
          <AdminCard title="Ringkasan">
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Tipe</dt>
                <dd className="text-right">
                  {ORDER_TYPE_LABEL[order.type]} · {order.channel}
                </dd>
              </div>
              {order.type === 'rent' && deadline.deadline ? (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">Tenggat sewa</dt>
                    <dd className="text-right font-medium">{formatDate(deadline.deadline)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">Status tenggat</dt>
                    <dd className="text-right">
                      <StatusBadge
                        tone={
                          finished
                            ? 'neutral'
                            : deadline.lateDays > 0
                              ? 'danger'
                              : deadline.daysLeft === 0
                                ? 'warning'
                                : 'info'
                        }
                      >
                        {finished
                          ? 'Selesai'
                          : deadline.lateDays > 0
                            ? `Terlambat ${deadline.lateDays} hari`
                            : deadline.daysLeft === 0
                              ? 'Jatuh tempo hari ini'
                              : `Sisa ${deadline.daysLeft} hari`}
                      </StatusBadge>
                    </dd>
                  </div>
                </>
              ) : null}
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="text-right tabular-nums">{rupiah(order.subtotal)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Diskon</dt>
                <dd className="text-right tabular-nums">{rupiah(order.discount)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Ongkir</dt>
                <dd className="text-right tabular-nums">{rupiah(order.shippingFee)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Deposit sewa 50% (dikembalikan)</dt>
                <dd className="text-right tabular-nums">{rupiah(order.depositTotal)}</dd>
              </div>
              <div className="mt-2 flex items-center justify-between gap-4 border-t border-border pt-3">
                <dt className="font-semibold">Grand total</dt>
                <dd className="text-right font-semibold tabular-nums">{rupiah(order.grandTotal)}</dd>
              </div>
              {order.returnedAt ? (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Deposit kembali</dt>
                  <dd className="text-right tabular-nums">{rupiah(order.depositRefunded)}</dd>
                </div>
              ) : null}
            </dl>
            <div className="my-3 border-t border-border" />
            <div className="flex flex-col gap-0.5">
              <p className="font-medium">
                {customerLabel(detail.customer, detail.customerName)}
              </p>
              <p className="text-sm text-muted-foreground">
                {detail.customerEmail ??
                  (detail.order.channel === 'pos' ? 'Pelanggan manual · POS' : 'Tanpa akun')}
              </p>
            </div>
            {order.shippingAddress ? (
              <p className="mb-1 text-sm text-muted-foreground">
                {Object.entries(order.shippingAddress)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(' · ')}
              </p>
            ) : null}
            {order.trackingNo ? (
              <p className="mb-1">
                Resi: <strong>{order.trackingNo}</strong>
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              Dibuat {formatDateTime(order.createdAt)}
              {order.paidAt ? ` · Dibayar ${formatDateTime(order.paidAt)}` : ''}
            </p>
          </AdminCard>

          <AdminCard title="Ubah status">
            {detail.allowed.length === 0 ? (
              <p className="text-muted-foreground">Tidak ada transisi yang tersedia.</p>
            ) : (
              <div className="flex flex-col gap-3">
                <Field label="Status baru" htmlFor="order-status">
                  <SelectInput
                    ariaLabel="Status baru"
                    value={target}
                    onChange={setTarget}
                    options={[
                      { value: '', label: '— pilih —' },
                      ...detail.allowed.map((s) => ({
                        value: s,
                        label: ORDER_STATUS_LABEL[s] ?? s,
                      })),
                    ]}
                  />
                </Field>
                {target === 'shipped' ? (
                  <Field label="Nomor resi" htmlFor="order-tracking" required>
                    <input
                      id="order-tracking"
                      className="input"
                      value={trackingNo}
                      onChange={(e) => setTrackingNo(e.target.value)}
                    />
                  </Field>
                ) : null}
                <Field label="Catatan" htmlFor="order-note">
                  <input
                    id="order-note"
                    className="input"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </Field>
                <button
                  type="button"
                  className={buttonClass({ variant: 'primary', block: true })}
                  disabled={busy || !target || (target === 'shipped' && !trackingNo.trim())}
                  onClick={() => void applyStatus()}
                >
                  Terapkan
                </button>
              </div>
            )}
          </AdminCard>
        </div>
      </div>
    </AdminPage>
  )
}

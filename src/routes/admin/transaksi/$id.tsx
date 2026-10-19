import { createFileRoute, Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { adminOrderDetailOptions, returnRental, updateOrderStatus } from '#/server/fn/admin'
import { formatDateTime, rupiah } from '#/lib/format'
import { ORDER_STATUS_LABEL, ORDER_TYPE_LABEL } from '#/lib/order-status'
import { AdminPage } from '#/components/admin/page'
import { AdminCard } from '#/components/admin/card'
import { AdminTable } from '#/components/admin/table'
import { OrderStatusBadge } from '#/components/admin/badge'
import { Field, SelectInput } from '#/components/admin/field'
import { buttonClass } from '#/components/admin/button'

export const Route = createFileRoute('/admin/transaksi/$id')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(adminOrderDetailOptions(params.id)),
  component: TransaksiDetailPage,
})

function TransaksiDetailPage() {
  const { id } = Route.useParams()
  const detail = Route.useLoaderData()
  const queryClient = useQueryClient()
  const updateFn = useServerFn(updateOrderStatus)
  const returnFn = useServerFn(returnRental)

  const order = detail.order
  const [target, setTarget] = useState<string>('')
  const [note, setNote] = useState('')
  const [trackingNo, setTrackingNo] = useState(order.trackingNo ?? '')
  const [busy, setBusy] = useState(false)

  const [ret, setRet] = useState({
    lateDays: '0',
    lateFee: '0',
    damageFee: '0',
    depositRefund: String(order.depositTotal),
    conditionNote: '',
  })

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
    order.type === 'rent' && ['rented', 'overdue'].includes(order.status) && detail.returns.length === 0

  return (
    <AdminPage
      title={order.code}
      description={`${ORDER_TYPE_LABEL[order.type]} · ${order.channel}`}
      breadcrumb={[{ label: 'Transaksi', to: '/admin/transaksi' }, { label: order.code }]}
      actions={
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} />
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
                  <th scope="col" className="text-right">
                    Harga satuan
                  </th>
                </>
              }
            >
              {detail.items.map((it) => (
                <tr key={it.id}>
                  <td>{it.name}</td>
                  <td>{it.rentalUnitSerial ?? '—'}</td>
                  <td>
                    {it.rentStart && it.rentEnd
                      ? `${formatDateTime(it.rentStart)} → ${formatDateTime(it.rentEnd)} (${it.rentDays} hari)`
                      : '—'}
                  </td>
                  <td className="text-right">{it.qty}</td>
                  <td className="text-right">{rupiah(it.unitPrice)}</td>
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
                    {log.note ? <div className="w-full text-sm">{log.note}</div> : null}
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
                    <th scope="col" className="text-right">
                      Jumlah
                    </th>
                    <th scope="col">Status</th>
                    <th scope="col">Signature OK</th>
                    <th scope="col">Waktu</th>
                  </>
                }
              >
                {detail.payments.map((pay) => (
                  <tr key={pay.id}>
                    <td>{pay.provider}</td>
                    <td className="text-right">{rupiah(pay.grossAmount)}</td>
                    <td>{pay.status}</td>
                    <td>{pay.signatureValid ? '✓' : '✗'}</td>
                    <td>{formatDateTime(pay.createdAt)}</td>
                  </tr>
                ))}
              </AdminTable>
            )}
          </AdminCard>

          {canReturn ? (
            <AdminCard title="Pengembalian sewa">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                <Field label="Telat (hari)" className="md:col-span-1">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={ret.lateDays}
                    onChange={(e) => setRet({ ...ret, lateDays: e.target.value })}
                  />
                </Field>
                <Field label="Denda telat" className="md:col-span-1">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={ret.lateFee}
                    onChange={(e) => setRet({ ...ret, lateFee: e.target.value })}
                  />
                </Field>
                <Field label="Denda rusak" className="md:col-span-1">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={ret.damageFee}
                    onChange={(e) => setRet({ ...ret, damageFee: e.target.value })}
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
                Catat pengembalian
              </button>
            </AdminCard>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 xl:col-span-4">
          <AdminCard title="Ringkasan">
            <dl className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Tipe</dt>
                <dd>
                  {ORDER_TYPE_LABEL[order.type]} · {order.channel}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{rupiah(order.subtotal)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Diskon</dt>
                <dd>{rupiah(order.discount)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Ongkir</dt>
                <dd>{rupiah(order.shippingFee)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Deposit</dt>
                <dd>{rupiah(order.depositTotal)}</dd>
              </div>
              <div className="mt-2 flex items-center justify-between border-t pt-2">
                <dt className="font-semibold">Grand total</dt>
                <dd className="font-semibold">{rupiah(order.grandTotal)}</dd>
              </div>
            </dl>
            <hr className="my-3" />
            <p className="mb-1">
              <strong>{detail.customer ?? 'Walk-in'}</strong>
              <br />
              {detail.customerEmail}
            </p>
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

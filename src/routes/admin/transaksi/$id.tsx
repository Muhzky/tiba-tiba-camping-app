import { createFileRoute, Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { toast } from 'sonner'
import { adminOrderDetailOptions, returnRental, updateOrderStatus } from '#/server/fn/admin'
import { formatDateTime, rupiah } from '#/lib/format'
import { ORDER_STATUS_LABEL, ORDER_TYPE_LABEL, orderStatusTone } from '#/lib/order-status'

export const Route = createFileRoute('/admin/transaksi/$id')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(adminOrderDetailOptions(params.id)),
  component: TransaksiDetailPage,
})

const TONE_BADGE: Record<string, string> = {
  pending: 'badge-warning',
  success: 'badge-success',
  info: 'badge-info',
  destructive: 'badge-danger',
}

function badge(status: string) {
  return `badge ${TONE_BADGE[orderStatusTone(status)] ?? 'badge-secondary'}`
}

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
    <>
      <div className="section-header d-flex justify-content-between align-items-center">
        <h1>
          {order.code} <span className={badge(order.status)}>{ORDER_STATUS_LABEL[order.status] ?? order.status}</span>
        </h1>
        <Link to="/admin/transaksi" className="btn btn-secondary">
          ← Kembali
        </Link>
      </div>
      <div className="section-body">
        <div className="row">
          <div className="col-lg-8">
            <div className="card mb-3">
              <div className="card-header">
                <h4>Item</h4>
              </div>
              <div className="card-body table-responsive">
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>Produk</th>
                      <th>Serial</th>
                      <th>Periode sewa</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Harga satuan</th>
                    </tr>
                  </thead>
                  <tbody>
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
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card mb-3">
              <div className="card-header">
                <h4>Riwayat status</h4>
              </div>
              <div className="card-body">
                {detail.logs.length === 0 ? (
                  <p className="text-muted mb-0">Belum ada riwayat.</p>
                ) : (
                  <ul className="list-unstyled mb-0">
                    {detail.logs.map((log) => (
                      <li key={log.id} className="mb-2">
                        <span className={badge(log.toStatus)}>
                          {log.fromStatus ? ORDER_STATUS_LABEL[log.fromStatus] : 'Mulai'} →{' '}
                          {ORDER_STATUS_LABEL[log.toStatus]}
                        </span>{' '}
                        <small className="text-muted">{formatDateTime(log.createdAt)}</small>
                        {log.note ? <div className="text-sm">{log.note}</div> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="card mb-3">
              <div className="card-header">
                <h4>Pembayaran</h4>
              </div>
              <div className="card-body table-responsive">
                {detail.payments.length === 0 ? (
                  <p className="text-muted mb-0">Belum ada pembayaran.</p>
                ) : (
                  <table className="table table-sm mb-0">
                    <thead>
                      <tr>
                        <th>Provider</th>
                        <th className="text-right">Jumlah</th>
                        <th>Status</th>
                        <th>Signature OK</th>
                        <th>Waktu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.payments.map((pay) => (
                        <tr key={pay.id}>
                          <td>{pay.provider}</td>
                          <td className="text-right">{rupiah(pay.grossAmount)}</td>
                          <td>{pay.status}</td>
                          <td>{pay.signatureValid ? '✓' : '✗'}</td>
                          <td>{formatDateTime(pay.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {canReturn ? (
              <div className="card mb-3">
                <div className="card-header">
                  <h4>Pengembalian sewa</h4>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="form-group col-md-2">
                      <label>Telat (hari)</label>
                      <input
                        className="form-control"
                        type="number"
                        min={0}
                        value={ret.lateDays}
                        onChange={(e) => setRet({ ...ret, lateDays: e.target.value })}
                      />
                    </div>
                    <div className="form-group col-md-2">
                      <label>Denda telat</label>
                      <input
                        className="form-control"
                        type="number"
                        min={0}
                        value={ret.lateFee}
                        onChange={(e) => setRet({ ...ret, lateFee: e.target.value })}
                      />
                    </div>
                    <div className="form-group col-md-2">
                      <label>Denda rusak</label>
                      <input
                        className="form-control"
                        type="number"
                        min={0}
                        value={ret.damageFee}
                        onChange={(e) => setRet({ ...ret, damageFee: e.target.value })}
                      />
                    </div>
                    <div className="form-group col-md-2">
                      <label>Deposit dikembalikan</label>
                      <input
                        className="form-control"
                        type="number"
                        min={0}
                        value={ret.depositRefund}
                        onChange={(e) => setRet({ ...ret, depositRefund: e.target.value })}
                      />
                    </div>
                    <div className="form-group col-md-4">
                      <label>Kondisi saat kembali</label>
                      <input
                        className="form-control"
                        value={ret.conditionNote}
                        onChange={(e) => setRet({ ...ret, conditionNote: e.target.value })}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void submitReturn()}
                  >
                    Catat pengembalian
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="col-lg-4">
            <div className="card mb-3">
              <div className="card-header">
                <h4>Ringkasan</h4>
              </div>
              <div className="card-body">
                <dl className="mb-0">
                  <div className="d-flex justify-content-between">
                    <dt>Tipe</dt>
                    <dd>
                      {ORDER_TYPE_LABEL[order.type]} · {order.channel}
                    </dd>
                  </div>
                  <div className="d-flex justify-content-between">
                    <dt>Subtotal</dt>
                    <dd>{rupiah(order.subtotal)}</dd>
                  </div>
                  <div className="d-flex justify-content-between">
                    <dt>Diskon</dt>
                    <dd>{rupiah(order.discount)}</dd>
                  </div>
                  <div className="d-flex justify-content-between">
                    <dt>Ongkir</dt>
                    <dd>{rupiah(order.shippingFee)}</dd>
                  </div>
                  <div className="d-flex justify-content-between">
                    <dt>Deposit</dt>
                    <dd>{rupiah(order.depositTotal)}</dd>
                  </div>
                  <div className="d-flex justify-content-between border-top pt-2 mt-2">
                    <dt>Grand total</dt>
                    <dd className="font-weight-bold">{rupiah(order.grandTotal)}</dd>
                  </div>
                </dl>
                <hr />
                <p className="mb-1">
                  <strong>{detail.customer ?? 'Walk-in'}</strong>
                  <br />
                  {detail.customerEmail}
                </p>
                {order.shippingAddress ? (
                  <p className="text-muted mb-1 text-sm">
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
                <p className="text-muted text-sm mb-0">
                  Dibuat {formatDateTime(order.createdAt)}
                  {order.paidAt ? ` · Dibayar ${formatDateTime(order.paidAt)}` : ''}
                </p>
              </div>
            </div>

            <div className="card mb-3">
              <div className="card-header">
                <h4>Ubah status</h4>
              </div>
              <div className="card-body">
                {detail.allowed.length === 0 ? (
                  <p className="text-muted mb-0">Tidak ada transisi yang tersedia.</p>
                ) : (
                  <>
                    <div className="form-group">
                      <label>Status baru</label>
                      <select
                        className="form-control"
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                      >
                        <option value="">— pilih —</option>
                        {detail.allowed.map((s) => (
                          <option key={s} value={s}>
                            {ORDER_STATUS_LABEL[s] ?? s}
                          </option>
                        ))}
                      </select>
                    </div>
                    {target === 'shipped' ? (
                      <div className="form-group">
                        <label>Nomor resi *</label>
                        <input
                          className="form-control"
                          value={trackingNo}
                          onChange={(e) => setTrackingNo(e.target.value)}
                        />
                      </div>
                    ) : null}
                    <div className="form-group">
                      <label>Catatan</label>
                      <input
                        className="form-control"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy || !target || (target === 'shipped' && !trackingNo.trim())}
                      onClick={() => void applyStatus()}
                    >
                      Terapkan
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

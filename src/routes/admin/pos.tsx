import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { toast } from 'sonner'
import { createPosOrder, posVariantsOptions } from '#/server/fn/admin'
import { rentalDays } from '#/lib/order-totals'
import { rupiah } from '#/lib/format'

export const Route = createFileRoute('/admin/pos')({
  component: PosPage,
})

type Line = {
  variantId: string
  name: string
  sku: string
  qty: number
  stock: number
  salePrice: number
  discountPercent: number
  rentPricePerDay: number | null
  rentDeposit: number
  isRentable: boolean
}

function PosPage() {
  const [mode, setMode] = useState<'buy' | 'rent'>('buy')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris'>('cash')
  const [customerName, setCustomerName] = useState('')
  const [rentStart, setRentStart] = useState('')
  const [rentEnd, setRentEnd] = useState('')
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [busy, setBusy] = useState(false)
  const [doneId, setDoneId] = useState<string | null>(null)

  const { data: variants } = useQuery(posVariantsOptions(search))
  const createFn = useServerFn(createPosOrder)
  const queryClient = useQueryClient()

  const days =
    mode === 'rent' && rentStart && rentEnd
      ? rentalDays(new Date(rentStart), new Date(rentEnd))
      : 0

  const unitBuy = (l: Line) => Math.round(l.salePrice - (l.salePrice * l.discountPercent) / 100)
  const subtotal =
    mode === 'buy'
      ? lines.reduce((sum, l) => sum + unitBuy(l) * l.qty, 0)
      : lines.reduce((sum, l) => sum + (l.rentPricePerDay ?? 0) * days * l.qty, 0)
  const deposit = mode === 'rent' ? lines.reduce((sum, l) => sum + l.rentDeposit * l.qty, 0) : 0
  const grandTotal = subtotal + deposit

  const addLine = (v: NonNullable<typeof variants>[number]) => {
    setLines((rows) => {
      const found = rows.find((r) => r.variantId === v.variantId)
      if (found) {
        if (mode === 'buy' && found.qty >= v.stock) return rows
        return rows.map((r) => (r.variantId === v.variantId ? { ...r, qty: r.qty + 1 } : r))
      }
      return [
        ...rows,
        {
          variantId: v.variantId,
          name: v.name,
          sku: v.sku,
          qty: 1,
          stock: v.stock,
          salePrice: v.salePrice,
          discountPercent: v.discountPercent,
          rentPricePerDay: v.rentPricePerDay,
          rentDeposit: v.rentDeposit,
          isRentable: v.isRentable,
        },
      ]
    })
  }

  const submit = async () => {
    if (lines.length === 0) {
      toast.error('Keranjang kosong.')
      return
    }
    if (mode === 'rent' && (!rentStart || !rentEnd)) {
      toast.error('Isi periode sewa.')
      return
    }
    setBusy(true)
    try {
      const res = await createFn({
        data: {
          mode,
          paymentMethod,
          customerName: customerName || undefined,
          rentStart: mode === 'rent' ? new Date(rentStart).toISOString() : undefined,
          rentEnd: mode === 'rent' ? new Date(rentEnd).toISOString() : undefined,
          items: lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
        },
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'products'] })
      setLines([])
      setCustomerName('')
      setDoneId(res.orderId)
      toast.success('Transaksi POS tersimpan.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan transaksi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="section-header">
        <h1>POS Kasir</h1>
      </div>
      <div className="section-body">
        <div className="row">
          <div className="col-lg-7">
            <div className="card mb-3">
              <div className="card-header">
                <h4>Cari produk</h4>
              </div>
              <div className="card-body">
                <form
                  className="form-inline mb-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    setSearch(q)
                  }}
                >
                  <input
                    className="form-control mr-2"
                    style={{ maxWidth: 280 }}
                    placeholder="Nama produk…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                  <button type="submit" className="btn btn-secondary">
                    Cari
                  </button>
                </form>
                <div className="table-responsive" style={{ maxHeight: 340, overflowY: 'auto' }}>
                  <table className="table table-sm mb-0">
                    <thead>
                      <tr>
                        <th>Produk</th>
                        <th>SKU</th>
                        <th className="text-right">Harga</th>
                        <th className="text-right">Stok</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {(variants ?? []).map((v) => (
                        <tr key={v.variantId}>
                          <td>
                            {v.name}
                            {mode === 'rent' && v.isRentable && v.rentPricePerDay ? (
                              <span className="badge badge-info ml-1">
                                {rupiah(v.rentPricePerDay)}/hari
                              </span>
                            ) : null}
                          </td>
                          <td>
                            <code>{v.sku}</code>
                          </td>
                          <td className="text-right">
                            {mode === 'buy' ? (
                              rupiah(Math.round(v.salePrice - (v.salePrice * v.discountPercent) / 100))
                            ) : v.rentPricePerDay ? (
                              rupiah(v.rentPricePerDay)
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="text-right">{v.stock}</td>
                          <td className="text-right">
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              disabled={
                                busy ||
                                (mode === 'rent' && (!v.isRentable || !v.rentPricePerDay)) ||
                                (mode === 'buy' && v.stock < 1)
                              }
                              onClick={() => addLine(v)}
                            >
                              Tambah
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(variants ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center text-muted">
                            Ketik nama lalu tekan Cari.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-5">
            <div className="card mb-3">
              <div className="card-header">
                <h4>Keranjang</h4>
              </div>
              <div className="card-body">
                <div className="form-row mb-3">
                  <div className="col-6">
                    <label className="d-block">Mode</label>
                    <div className="form-check form-check-inline">
                      <label className="form-check-label">
                        <input
                          className="form-check-input mr-1"
                          type="radio"
                          checked={mode === 'buy'}
                          onChange={() => setMode('buy')}
                        />
                        Beli
                      </label>
                    </div>
                    <div className="form-check form-check-inline">
                      <label className="form-check-label">
                        <input
                          className="form-check-input mr-1"
                          type="radio"
                          checked={mode === 'rent'}
                          onChange={() => setMode('rent')}
                        />
                        Sewa
                      </label>
                    </div>
                  </div>
                  <div className="col-6">
                    <label>Bayar</label>
                    <select
                      className="form-control"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                    >
                      <option value="cash">Tunai</option>
                      <option value="qris">QRIS</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Nama pelanggan (opsional)</label>
                  <input
                    className="form-control"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>

                {mode === 'rent' ? (
                  <div className="row">
                    <div className="form-group col-6">
                      <label>Mulai</label>
                      <input
                        className="form-control"
                        type="datetime-local"
                        value={rentStart}
                        onChange={(e) => setRentStart(e.target.value)}
                      />
                    </div>
                    <div className="form-group col-6">
                      <label>Selesai</label>
                      <input
                        className="form-control"
                        type="datetime-local"
                        value={rentEnd}
                        onChange={(e) => setRentEnd(e.target.value)}
                      />
                    </div>
                  </div>
                ) : null}

                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th style={{ width: 100 }}>Qty</th>
                      <th className="text-right">Subtotal</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={l.variantId}>
                        <td>
                          {l.name}
                          <br />
                          <small className="text-muted">{l.sku}</small>
                        </td>
                        <td>
                          <div className="input-group input-group-sm">
                            <div className="input-group-prepend">
                              <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() =>
                                  setLines((rows) =>
                                    rows.map((r, j) =>
                                      j === i ? { ...r, qty: Math.max(1, r.qty - 1) } : r,
                                    ),
                                  )
                                }
                              >
                                −
                              </button>
                            </div>
                            <input className="form-control text-center" readOnly value={l.qty} />
                            <div className="input-group-append">
                              <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() =>
                                  setLines((rows) =>
                                    rows.map((r, j) =>
                                      j === i
                                        ? { ...r, qty: mode === 'buy' ? Math.min(r.stock, r.qty + 1) : r.qty + 1 }
                                        : r,
                                    ),
                                  )
                                }
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="text-right">
                          {rupiah(
                            mode === 'buy'
                              ? unitBuy(l) * l.qty
                              : (l.rentPricePerDay ?? 0) * days * l.qty,
                          )}
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="btn btn-sm btn-link text-danger p-0"
                            onClick={() => setLines((rows) => rows.filter((r) => r.variantId !== l.variantId))}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                    {lines.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center text-muted">
                          Belum ada item.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>

                <dl className="mb-3">
                  {mode === 'rent' ? (
                    <div className="d-flex justify-content-between">
                      <dt>Durasi</dt>
                      <dd>{days} hari</dd>
                    </div>
                  ) : null}
                  <div className="d-flex justify-content-between">
                    <dt>Subtotal</dt>
                    <dd>{rupiah(subtotal)}</dd>
                  </div>
                  {mode === 'rent' ? (
                    <div className="d-flex justify-content-between">
                      <dt>Deposit (dikembalikan)</dt>
                      <dd>{rupiah(deposit)}</dd>
                    </div>
                  ) : null}
                  <div className="d-flex justify-content-between border-top pt-2 mt-2">
                    <dt>TOTAL</dt>
                    <dd className="font-weight-bold">{rupiah(grandTotal)}</dd>
                  </div>
                </dl>

                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  disabled={busy || lines.length === 0}
                  onClick={() => void submit()}
                >
                  {busy ? 'Menyimpan…' : 'Bayar & simpan'}
                </button>

                {doneId ? (
                  <p className="mt-3 mb-0">
                    Tersimpan.{' '}
                    <Link to="/admin/transaksi/$id" params={{ id: doneId }}>
                      Lihat transaksi
                    </Link>
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

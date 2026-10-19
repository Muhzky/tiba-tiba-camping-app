import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { toast } from 'sonner'
import { Minus, Plus, Search, X } from 'lucide-react'
import { createPosOrder, posVariantsOptions } from '#/server/fn/admin'
import { rentalDays } from '#/lib/order-totals'
import { rupiah } from '#/lib/format'
import { AdminPage } from '#/components/admin/page'
import { AdminCard } from '#/components/admin/card'
import { AdminTable } from '#/components/admin/table'
import { StatusBadge } from '#/components/admin/badge'
import { Field, SearchInput, SelectInput } from '#/components/admin/field'
import { AdminButton, buttonClass } from '#/components/admin/button'
import { cn } from '#/lib/utils'

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
    <AdminPage
      title="POS Kasir"
      description="Transaksi cepat di toko: beli atau sewa, bayar tunai atau QRIS."
    >
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <AdminCard title="Cari produk">
            <form
              className="mb-3 flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                setSearch(q)
              }}
            >
              <SearchInput
                label="produk"
                placeholder="Nama produk…"
                className="w-full sm:w-64"
                value={q}
                onChange={setQ}
              />
              <button type="submit" className={buttonClass({ variant: 'neutral' })}>
                <Search aria-hidden="true" />
                Cari
              </button>
            </form>
            <div className="max-h-[340px] overflow-y-auto">
              <AdminTable
                head={
                  <>
                    <th scope="col">Produk</th>
                    <th scope="col">SKU</th>
                    <th scope="col" className="text-right">
                      Harga
                    </th>
                    <th scope="col" className="text-right">
                      Stok
                    </th>
                    <th scope="col" />
                  </>
                }
              >
                {(variants ?? []).map((v) => (
                  <tr key={v.variantId}>
                    <td>
                      <div className="flex flex-wrap items-center gap-1">
                        {v.name}
                        {mode === 'rent' && v.isRentable && v.rentPricePerDay ? (
                          <StatusBadge tone="info">{rupiah(v.rentPricePerDay)}/hari</StatusBadge>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <code>{v.sku}</code>
                    </td>
                    <td className="text-right">
                      {mode === 'buy'
                        ? rupiah(Math.round(v.salePrice - (v.salePrice * v.discountPercent) / 100))
                        : v.rentPricePerDay
                          ? rupiah(v.rentPricePerDay)
                          : '—'}
                    </td>
                    <td className="text-right">{v.stock}</td>
                    <td className="text-right">
                      <AdminButton
                        size="sm"
                        variant="primary"
                        disabled={
                          busy ||
                          (mode === 'rent' && (!v.isRentable || !v.rentPricePerDay)) ||
                          (mode === 'buy' && v.stock < 1)
                        }
                        onClick={() => addLine(v)}
                      >
                        Tambah
                      </AdminButton>
                    </td>
                  </tr>
                ))}
                {(variants ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted-foreground">
                      Ketik nama lalu tekan Cari.
                    </td>
                  </tr>
                ) : null}
              </AdminTable>
            </div>
          </AdminCard>
        </div>

        <div className="xl:col-span-5">
          <AdminCard title="Keranjang">
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <fieldset>
                <legend className="field__label">Mode</legend>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="pos-mode"
                      className="radio"
                      checked={mode === 'buy'}
                      onChange={() => setMode('buy')}
                    />
                    Beli
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="pos-mode"
                      className="radio"
                      checked={mode === 'rent'}
                      onChange={() => setMode('rent')}
                    />
                    Sewa
                  </label>
                </div>
              </fieldset>
              <Field label="Bayar" htmlFor="pos-payment">
                <SelectInput
                  ariaLabel="Metode pembayaran"
                  value={paymentMethod}
                  onChange={(value) => setPaymentMethod(value as typeof paymentMethod)}
                  options={[
                    { value: 'cash', label: 'Tunai' },
                    { value: 'qris', label: 'QRIS' },
                  ]}
                />
              </Field>
            </div>

            <Field label="Nama pelanggan (opsional)" htmlFor="pos-customer" className="mb-3">
              <input
                id="pos-customer"
                className="input"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </Field>

            {mode === 'rent' ? (
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Mulai" htmlFor="pos-rent-start">
                  <input
                    id="pos-rent-start"
                    className="input"
                    type="datetime-local"
                    value={rentStart}
                    onChange={(e) => setRentStart(e.target.value)}
                  />
                </Field>
                <Field label="Selesai" htmlFor="pos-rent-end">
                  <input
                    id="pos-rent-end"
                    className="input"
                    type="datetime-local"
                    value={rentEnd}
                    onChange={(e) => setRentEnd(e.target.value)}
                  />
                </Field>
              </div>
            ) : null}

            <AdminTable
              head={
                <>
                  <th scope="col">Item</th>
                  <th scope="col" className="w-[100px]">
                    Qty
                  </th>
                  <th scope="col" className="text-right">
                    Subtotal
                  </th>
                  <th scope="col" />
                </>
              }
            >
              {lines.map((l, i) => (
                <tr key={l.variantId}>
                  <td>
                    {l.name}
                    <br />
                    <small className="text-muted-foreground">{l.sku}</small>
                  </td>
                  <td>
                    <div className="input-group">
                      <button
                        type="button"
                        className="button button--neutral button--icon-only"
                        aria-label={`Kurangi ${l.name}`}
                        onClick={() =>
                          setLines((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, qty: Math.max(1, r.qty - 1) } : r,
                            ),
                          )
                        }
                      >
                        <Minus aria-hidden="true" />
                      </button>
                      <input className="input text-center" readOnly value={l.qty} aria-label={`Qty ${l.name}`} />
                      <button
                        type="button"
                        className="button button--neutral button--icon-only"
                        aria-label={`Tambah ${l.name}`}
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
                        <Plus aria-hidden="true" />
                      </button>
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
                    <AdminButton
                      size="sm"
                      variant="ghost"
                      iconOnly
                      aria-label={`Hapus ${l.name}`}
                      onClick={() => setLines((rows) => rows.filter((r) => r.variantId !== l.variantId))}
                    >
                      <X aria-hidden="true" />
                    </AdminButton>
                  </td>
                </tr>
              ))}
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-muted-foreground">
                    Belum ada item.
                  </td>
                </tr>
              ) : null}
            </AdminTable>

            <dl className="mb-3 mt-3 flex flex-col gap-2">
              {mode === 'rent' ? (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Durasi</dt>
                  <dd>{days} hari</dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{rupiah(subtotal)}</dd>
              </div>
              {mode === 'rent' ? (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Deposit (dikembalikan)</dt>
                  <dd>{rupiah(deposit)}</dd>
                </div>
              ) : null}
              <div className="mt-2 flex items-center justify-between border-t pt-2">
                <dt className="font-semibold">TOTAL</dt>
                <dd className="font-semibold">{rupiah(grandTotal)}</dd>
              </div>
            </dl>

            <button
              type="button"
              className={cn(buttonClass({ variant: 'primary', block: true }))}
              disabled={busy || lines.length === 0}
              onClick={() => void submit()}
            >
              {busy ? 'Menyimpan…' : 'Bayar & simpan'}
            </button>

            {doneId ? (
              <p className="mt-3">
                Tersimpan.{' '}
                <Link to="/admin/transaksi/$id" params={{ id: doneId }}>
                  Lihat transaksi
                </Link>
              </p>
            ) : null}
          </AdminCard>
        </div>
      </div>
    </AdminPage>
  )
}

import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { Printer } from 'lucide-react'
import { meOptions } from '#/server/fn/auth'
import { receiptOptions } from '#/server/fn/receipt'
import type { ReceiptData } from '#/server/fn/receipt'
import { formatDate, formatDateTime, rupiah } from '#/lib/format'
import { rentalDays, rentalDeadlineInfo } from '#/lib/order-totals'
import { ORDER_STATUS_LABEL, ORDER_TYPE_LABEL, customerLabel } from '#/lib/order-status'
import { cn } from '#/lib/utils'
import appCss from '../../styles.css?url'

const receiptSearchSchema = z.object({
  paper: z.enum(['a4', 'thermal']).optional(),
  print: z.boolean().optional(),
})

export const Route = createFileRoute('/struk/$code')({
  validateSearch: (search) => receiptSearchSchema.parse(search),
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(meOptions)
    if (!user) {
      throw redirect({ to: '/masuk', search: { redirect: location.href } })
    }
    return { user }
  },
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(receiptOptions(params.code)),
  head: ({ loaderData }) => ({
    links: [{ rel: 'stylesheet', href: appCss }],
    meta: [
      {
        title: loaderData
          ? `Struk ${loaderData.order.code} — Tiba Tiba Camping`
          : 'Struk — Tiba Tiba Camping',
      },
    ],
  }),
  component: ReceiptPage,
  errorComponent: ReceiptError,
})

function itemTotal(item: ReceiptData['items'][number]): number {
  if (item.rentStart && item.rentEnd) {
    const days = item.rentDays ?? rentalDays(new Date(item.rentStart), new Date(item.rentEnd))
    return item.unitPrice * days * item.qty
  }
  return item.unitPrice * item.qty
}

function paymentMethodLabel(provider: string | undefined): string {
  if (!provider) return '—'
  if (provider === 'cash') return 'Tunai'
  if (provider === 'qris') return 'QRIS'
  if (provider === 'midtrans') return 'Midtrans'
  return provider
}

function ReceiptPage() {
  const data = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const search = Route.useSearch()
  const [paper, setPaper] = useState<'a4' | 'thermal'>(search.paper ?? 'a4')

  const { order, items, payments, settings, cashier } = data
  const isRent = order.type === 'rent'
  const isAdmin = user.role === 'admin' || user.role === 'owner'
  const paid = order.paymentStatus === 'paid'
  const deadline = rentalDeadlineInfo(items.map((item) => item.rentEnd))
  const latestPayment = payments.find((payment) => payment.status === 'paid') ?? payments.at(-1)

  useEffect(() => {
    if (!search.print) return
    const timer = window.setTimeout(() => window.print(), 500)
    return () => window.clearTimeout(timer)
  }, [search.print])

  const print = (next: 'a4' | 'thermal') => {
    setPaper(next)
    window.setTimeout(() => window.print(), 80)
  }

  const paperClass =
    paper === 'thermal'
      ? 'w-[80mm] max-w-full px-3 py-4 text-[11px] leading-snug'
      : 'w-full max-w-[210mm] px-8 py-8 text-sm'

  return (
    <div className="min-h-svh bg-neutral-200 px-3 py-6 print:bg-white print:p-0">
      <style>{`@page { size: ${paper === 'thermal' ? '80mm auto' : 'A4'}; margin: ${
        paper === 'thermal' ? '4mm' : '14mm'
      }; }`}</style>
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-3">
        <div className="flex w-full flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition hover:bg-surface"
              onClick={() => print('a4')}
            >
              <Printer className="size-4" aria-hidden="true" />
              Cetak A4
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition hover:bg-surface"
              onClick={() => print('thermal')}
            >
              <Printer className="size-4" aria-hidden="true" />
              Cetak struk 80 mm
            </button>
          </div>
          {isAdmin ? (
            <Link
              to="/admin/transaksi/$id"
              params={{ id: order.id }}
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              Kembali ke transaksi
            </Link>
          ) : (
            <Link
              to="/akun/pesanan"
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              Kembali ke pesanan
            </Link>
          )}
        </div>

        <section
          className={cn(
            'receipt-paper mx-auto bg-white text-black shadow-lg print:shadow-none',
            paperClass,
          )}
        >
          <header className="text-center">
            <p className="text-base font-bold tracking-[0.18em] uppercase">Tiba Tiba Camping</p>
            {settings.address ? <p className="mt-1">{settings.address}</p> : null}
            <p>
              {settings.contactPhone}
              {settings.contactEmail ? ` · ${settings.contactEmail}` : ''}
            </p>
          </header>

          <div className="my-3 border-t border-dashed border-black/40" />

          {!paid ? (
            <div className="receipt-watermark my-3 border-2 border-red-600 py-1 text-center text-sm font-black tracking-[0.2em] text-red-600">
              BELUM DIBAYAR
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-black/60">No. struk</span>
            <span className="text-right font-mono">{order.code}</span>
            <span className="text-black/60">Tanggal</span>
            <span className="text-right">{formatDateTime(order.paidAt ?? order.createdAt)}</span>
            {order.channel === 'pos' ? (
              <>
                <span className="text-black/60">Kasir</span>
                <span className="text-right">{cashier ?? '—'}</span>
              </>
            ) : null}
            <span className="text-black/60">Pelanggan</span>
            <span className="text-right">
              {customerLabel(data.customer, order.customerName)}
            </span>
            <span className="text-black/60">Layanan</span>
            <span className="text-right">
              {ORDER_TYPE_LABEL[order.type] ?? order.type} · {order.channel}
            </span>
            <span className="text-black/60">Status</span>
            <span className="text-right">{ORDER_STATUS_LABEL[order.status] ?? order.status}</span>
            {isRent && deadline.deadline ? (
              <>
                <span className="text-black/60">Tenggat sewa</span>
                <span className="text-right font-medium">{formatDate(deadline.deadline)}</span>
              </>
            ) : null}
          </div>

          <div className="my-3 border-t border-dashed border-black/40" />

          <table className="w-full border-collapse">
            <thead>
              <tr className="border-y border-black/30 text-left">
                <th className="py-1 font-semibold">Item</th>
                <th className="py-1 text-right font-semibold">Qty</th>
                {paper === 'a4' ? (
                  <th className="py-1 text-right font-semibold">Harga</th>
                ) : null}
                <th className="py-1 text-right font-semibold">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const days =
                  item.rentStart && item.rentEnd
                    ? (item.rentDays ??
                      rentalDays(new Date(item.rentStart), new Date(item.rentEnd)))
                    : null
                return (
                  <tr key={item.id} className="border-b border-black/10 align-top">
                    <td className="py-1.5 pr-2">
                      <div className="font-medium">{item.name}</div>
                      {item.serial ? (
                        <div className="text-[10px] text-black/60">Serial {item.serial}</div>
                      ) : null}
                      {item.rentStart && item.rentEnd ? (
                        <div className="text-[10px] text-black/60">
                          {formatDate(item.rentStart)} – {formatDate(item.rentEnd)} · {days} hari
                        </div>
                      ) : null}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{item.qty}</td>
                    {paper === 'a4' ? (
                      <td className="py-1.5 text-right tabular-nums">
                        {rupiah(item.unitPrice)}
                        {item.rentStart ? (
                          <span className="text-[10px] text-black/60">/hari</span>
                        ) : null}
                      </td>
                    ) : null}
                    <td className="py-1.5 text-right tabular-nums">{rupiah(itemTotal(item))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="mt-3 ml-auto flex w-full max-w-xs flex-col gap-1">
            <ReceiptRow label="Subtotal" value={rupiah(order.subtotal)} />
            {order.discount > 0 ? (
              <ReceiptRow label="Diskon" value={`−${rupiah(order.discount)}`} />
            ) : null}
            {order.shippingFee > 0 ? (
              <ReceiptRow label="Ongkir" value={rupiah(order.shippingFee)} />
            ) : null}
            {order.depositTotal > 0 ? (
              <ReceiptRow
                label="Deposit sewa 50% (dikembalikan)"
                value={rupiah(order.depositTotal)}
              />
            ) : null}
            <div className="my-1 border-t border-black/40" />
            <ReceiptRow label="Total" value={rupiah(order.grandTotal)} bold />
            <ReceiptRow
              label="Metode bayar"
              value={paymentMethodLabel(latestPayment?.provider)}
            />
            <ReceiptRow label="Pembayaran" value={paid ? 'Lunas' : 'Belum dibayar'} />
          </div>

          {isRent && order.returnedAt ? (
            <div className="mt-4 border-t border-dashed border-black/40 pt-3">
              <p className="font-semibold">Pengembalian sewa</p>
              <div className="mt-1 flex flex-col gap-1">
                <ReceiptRow label="Dikembalikan" value={formatDateTime(order.returnedAt)} />
                {order.lateDays > 0 ? (
                  <ReceiptRow label="Telat" value={`${order.lateDays} hari`} />
                ) : null}
                {order.lateFee > 0 ? (
                  <ReceiptRow label="Denda telat" value={rupiah(order.lateFee)} />
                ) : null}
                {order.damageFee > 0 ? (
                  <ReceiptRow label="Denda kerusakan" value={rupiah(order.damageFee)} />
                ) : null}
                <ReceiptRow label="Deposit kembali" value={rupiah(order.depositRefunded)} bold />
              </div>
            </div>
          ) : null}

          {order.notes && order.channel === 'web' ? (
            <p className="mt-4 text-[10px] text-black/60">Catatan: {order.notes}</p>
          ) : null}

          <div className="my-3 border-t border-dashed border-black/40" />

          <footer className="text-center text-[10px] text-black/70">
            {isRent ? (
              <p>
                Deposit sewa 50% dikembalikan setelah unit kembali dan diperiksa. Denda
                keterlambatan atau kerusakan dipotong dari deposit.
              </p>
            ) : null}
            <p className="mt-1 font-medium">Terima kasih sudah camping bersama kami.</p>
          </footer>
        </section>
      </div>
    </div>
  )
}

function ReceiptRow({
  label,
  value,
  bold = false,
}: {
  label: string
  value: string
  bold?: boolean
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3', bold && 'font-semibold')}>
      <span className="text-black/60">{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  )
}

function ReceiptError() {
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold">Struk tidak bisa dibuka</h1>
      <p className="text-sm text-muted-foreground">
        Struk tidak ditemukan atau bukan milik akun ini.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm font-medium">
        <Link to="/akun/pesanan" className="underline-offset-4 hover:underline">
          Riwayat pesanan
        </Link>
        <Link to="/admin/transaksi" className="underline-offset-4 hover:underline">
          Daftar transaksi
        </Link>
      </div>
    </div>
  )
}

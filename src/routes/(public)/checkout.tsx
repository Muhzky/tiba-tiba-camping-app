import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Store, Truck } from 'lucide-react'
import { meOptions } from '#/server/fn/auth'
import { cartOptions } from '#/server/fn/cart'
import {
  checkoutPreviewOptions,
  createOrder,
} from '#/server/fn/checkout'
import { addressesOptions } from '#/server/fn/account'
import { myOrdersOptions } from '#/server/fn/order'
import { paySnap } from '#/lib/snap'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Badge } from '#/components/ui/badge'
import { Skeleton } from '#/components/ui/skeleton'
import { rupiah } from '#/lib/format'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/(public)/checkout')({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(meOptions)
    if (!user) {
      throw redirect({ to: '/masuk', search: { redirect: location.href } })
    }
  },
  component: CheckoutPage,
})

function CheckoutPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [ship, setShip] = useState(true)
  const [addressId, setAddressId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  const { data: addresses, isLoading: loadingAddresses } = useQuery(addressesOptions)
  const previewInput = useMemo(() => ({ ship, addressId }), [ship, addressId])
  const preview = useQuery({
    ...checkoutPreviewOptions(previewInput),
    enabled: !ship || addressId !== null,
  })

  useEffect(() => {
    if (!addressId && addresses?.length) {
      setAddressId((addresses.find((a) => a.isDefault) ?? addresses[0]).id)
    }
  }, [addresses, addressId])

  const create = useServerFn(createOrder)
  const mutation = useMutation({
    mutationFn: () => create({ data: { ship, addressId: ship ? addressId : null, notes: notes || undefined } }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: cartOptions.queryKey })
      await queryClient.invalidateQueries({ queryKey: myOrdersOptions.queryKey })

      const firstError = result.orders.find((o) => o.snapError)
      const tokens = result.orders.flatMap((o) => (o.snapToken ? [o.snapToken] : []))

      if (tokens.length > 0) {
        try {
          for (const token of tokens) {
            await paySnap(token)
          }
          toast.success('Pembayaran diterima! Pesananmu sedang diproses.')
        } catch {
          toast.info('Selesaikan pembayaran lewat tautan di riwayat pesanan.', {
            description: 'Snap tertutup atau pembayaran gagal — pesanan tetap tersimpan.',
          })
        }
      } else {
        toast.error('Pembayaran belum dapat disiapkan.', {
          description: firstError?.snapError ?? 'Coba bayar ulang dari riwayat pesanan.',
        })
      }
      await navigate({ to: '/akun/pesanan' })
    },
    onError: (error) => {
      const msg = String(error.message)
      if (msg.includes('STOK_KURANG')) {
        toast.error('Stok berubah saat checkout.', { description: 'Periksa lagi keranjangmu.' })
      } else if (msg.includes('KERANJANG_KOSONG')) {
        toast.error('Keranjang kosong.')
      } else if (msg.includes('ALAMAT')) {
        toast.error('Pilih alamat pengiriman terlebih dahulu.')
      } else {
        toast.error('Gagal membuat pesanan.', { description: msg.slice(0, 160) })
      }
    },
  })

  const data = preview.data
  const empty =
    data && data.ready.length === 0 && data.po.length === 0 && data.rent.length === 0

  return (
    <div className="mx-auto max-w-5xl px-4 py-36 md:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="rounded-[24px] border border-border/70 bg-card p-6">
            <h2 className="text-base font-semibold">Metode penerimaan</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShip(true)}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border p-4 text-left transition',
                  ship ? 'border-primary bg-surface' : 'border-border hover:bg-surface/60',
                )}
              >
                <Truck className={cn('size-5', ship ? 'text-primary' : 'text-muted-foreground')} />
                <span>
                  <span className="block text-sm font-semibold">Kirim ke alamat</span>
                  <span className="block text-xs text-muted-foreground">Ongkir per zona</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShip(false)}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border p-4 text-left transition',
                  !ship ? 'border-primary bg-surface' : 'border-border hover:bg-surface/60',
                )}
              >
                <Store className={cn('size-5', !ship ? 'text-primary' : 'text-muted-foreground')} />
                <span>
                  <span className="block text-sm font-semibold">Ambil di toko</span>
                  <span className="block text-xs text-muted-foreground">Tanpa ongkir</span>
                </span>
              </button>
            </div>

            {ship ? (
              <div className="mt-5 grid gap-2">
                <Label>Alamat pengiriman</Label>
                {loadingAddresses ? (
                  <Skeleton className="h-11 w-full rounded-xl" />
                ) : addresses?.length ? (
                  <Select value={addressId ?? undefined} onValueChange={setAddressId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih alamat" />
                    </SelectTrigger>
                    <SelectContent>
                      {addresses.map((addr) => (
                        <SelectItem key={addr.id} value={addr.id}>
                          {addr.recipient} — {addr.city}, {addr.province}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-4 text-sm">
                    <span className="text-muted-foreground">Belum ada alamat tersimpan.</span>
                    <Button asChild size="sm" variant="outline" className="rounded-full">
                      <Link to="/akun">Tambah alamat</Link>
                    </Button>
                  </div>
                )}
                {data?.shipping.addressLabel ? (
                  <p className="text-xs text-muted-foreground">{data.shipping.addressLabel}</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Toko Tiba Tiba — Jl. Cempaka No. 12, Bandung. Buka 09.00–18.00 WIB.
              </p>
            )}

            <div className="mt-5 grid gap-2">
              <Label htmlFor="notes">Catatan (opsional)</Label>
              <Textarea
                id="notes"
                value={notes}
                maxLength={500}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Contoh: titip ke satpam kalau kosong…"
              />
            </div>
          </section>

          <section className="rounded-[24px] border border-border/70 bg-card p-6">
            <h2 className="text-base font-semibold">Item pesanan</h2>
            {!data ? (
              <Skeleton className="mt-4 h-24 rounded-2xl" />
            ) : empty ? (
              <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/70 p-8 text-center">
                <p className="text-sm text-muted-foreground">Keranjang kosong.</p>
                <Button asChild variant="outline" className="rounded-full">
                  <Link to="/katalog">Jelajahi katalog</Link>
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-5">
                {data.ready.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Siap kirim
                    </p>
                    <ul className="mt-2 space-y-2">
                      {data.ready.map((item) => (
                        <CheckoutRow
                          key={`${item.variantId}:${item.mode}`}
                          name={item.name}
                          meta={`${item.colorName ?? '-'} · ${item.qty}×`}
                          price={item.lineTotalLabel}
                        />
                      ))}
                    </ul>
                  </div>
                ) : null}
                {data.po.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Pre-Order — order terpisah
                    </p>
                    <ul className="mt-2 space-y-2">
                      {data.po.map((item) => (
                        <CheckoutRow
                          key={`${item.variantId}:${item.mode}`}
                          name={item.name}
                          meta={`${item.colorName ?? '-'} · ${item.qty}×`}
                          price={item.lineTotalLabel}
                        />
                      ))}
                    </ul>
                  </div>
                ) : null}
                {data.rent.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Sewa
                    </p>
                    <ul className="mt-2 space-y-2">
                      {data.rent.map((item) => (
                        <CheckoutRow
                          key={`${item.variantId}:${item.mode}:${item.rentStart}`}
                          name={item.name}
                          meta={`${item.colorName ?? '-'} · ${item.rentDays} hari · ${item.qty} unit${
                            item.depositLine > 0 ? ` · deposit ${rupiah(item.depositLine)}` : ''
                          }`}
                          price={item.lineTotalLabel}
                        />
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>

        <aside className="h-fit rounded-[24px] border border-border/70 bg-card p-6 lg:sticky lg:top-24">
          <h2 className="text-base font-semibold">Ringkasan biaya</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal siap kirim</dt>
              <dd className="font-medium">{rupiah(data?.readySubtotal ?? 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal pre-order (DP)</dt>
              <dd className="font-medium">{rupiah(data?.poDp ?? 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal sewa</dt>
              <dd className="font-medium">{rupiah(data?.rentSubtotal ?? 0)}</dd>
            </div>
            {(data?.depositTotal ?? 0) > 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Deposit (dikembalikan)</dt>
                <dd className="font-medium">{rupiah(data?.depositTotal ?? 0)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                Ongkir{data ? ` — ${data.shipping.zoneLabel}` : ''}
              </dt>
              <dd className="font-medium">{rupiah(data?.shipping.fee ?? 0)}</dd>
            </div>
            <div className="border-t border-border pt-2 text-base">
              <div className="flex justify-between font-semibold">
                <dt>Total bayar</dt>
                <dd>{rupiah(data?.totalDue ?? 0)}</dd>
              </div>
            </div>
          </dl>

          {data?.invalid.length ? (
            <p className="mt-4 rounded-xl bg-sale/10 p-3 text-xs text-sale">
              Stok kurang untuk {data.invalid.length} item — kurangi jumlah atau hapus item.
            </p>
          ) : null}

          <Button
            className="mt-5 h-11 w-full rounded-full font-semibold"
            disabled={
              mutation.isPending ||
              preview.isFetching ||
              !data ||
              empty ||
              data.invalid.length > 0 ||
              (ship && !addressId)
            }
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Membuat pesanan…' : 'Bayar Sekarang'}
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Pembayaran via Midtrans (kartu, VA, QRIS, e-wallet).
          </p>
        </aside>
      </div>
    </div>
  )
}

function CheckoutRow({ name, meta, price }: { name: string; meta: string; price: string }) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-2xl bg-surface/60 p-3">
      <div className="min-w-0">
        <p className="line-clamp-1 text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{meta}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold">{price}</p>
        <Badge className="mt-1 rounded-full bg-background px-1.5 py-0 text-[10px]">Siap bayar</Badge>
      </div>
    </li>
  )
}

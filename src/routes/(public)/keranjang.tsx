import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { Minus, Plus, ShoppingBag, Trash2, Truck } from 'lucide-react'
import {
  cartOptions,
  removeCartItem,
  updateCartQty,
} from '#/server/fn/cart'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Skeleton } from '#/components/ui/skeleton'
import { cn } from '#/lib/utils'
import { rupiah } from '#/lib/format'

export const Route = createFileRoute('/(public)/keranjang')({
  component: KeranjangPage,
})

const modeLabel: Record<string, string> = { buy: 'Beli', rent: 'Sewa', preorder: 'Pre-Order' }

function KeranjangPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data, isLoading } = useQuery(cartOptions)
  const update = useServerFn(updateCartQty)
  const remove = useServerFn(removeCartItem)

  const updateMutation = useMutation({
    mutationFn: (input: { variantId: string; mode: 'buy' | 'rent' | 'preorder'; qty: number }) =>
      update({ data: input }),
    onSuccess: (cart) => queryClient.setQueryData(cartOptions.queryKey, cart),
    onError: () => toast.error('Gagal memperbarui keranjang.'),
  })
  const removeMutation = useMutation({
    mutationFn: (input: { variantId: string; mode: 'buy' | 'rent' | 'preorder' }) =>
      remove({ data: input }),
    onSuccess: (cart) => queryClient.setQueryData(cartOptions.queryKey, cart),
    onError: () => toast.error('Gagal menghapus item.'),
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-36 md:px-8">
        <Skeleton className="h-9 w-56" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-[24px]" />
          ))}
        </div>
      </div>
    )
  }

  const items = data?.items ?? []

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-40 text-center">
        <div className="grid size-16 place-items-center rounded-full bg-surface">
          <ShoppingBag className="size-7 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Keranjang kosong</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Belum ada gear di keranjang. Intip katalog dan pilih tenda, sleeping bag, atau
          perlengkapan lainnya.
        </p>
        <Button asChild className="rounded-full">
          <Link to="/katalog">Jelajahi Katalog</Link>
        </Button>
      </div>
    )
  }

  const rentLines = items.filter((i) => i.mode === 'rent')
  const billable = items
  const billableSubtotal = billable.reduce((s, i) => s + i.lineTotal, 0)
  const depositTotal = items.reduce((s, i) => s + i.depositLine, 0)

  return (
    <div className="mx-auto max-w-5xl px-4 py-36 md:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Keranjang</h1>
      <p className="mt-1 text-sm text-muted-foreground">{data?.count} item dalam keranjang.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={`${item.variantId}:${item.mode}`}
              className="flex gap-4 rounded-[24px] border border-border/70 bg-card p-4"
            >
              <Link
                to="/produk/$slug"
                params={{ slug: item.slug }}
                className="size-20 shrink-0 overflow-hidden rounded-2xl bg-surface sm:size-24"
              >
                <img src={item.image} alt={item.name} className="size-full object-cover" />
              </Link>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to="/produk/$slug"
                      params={{ slug: item.slug }}
                      className="line-clamp-1 text-sm font-semibold hover:underline"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.colorName ?? 'Tanpa warna'} · {item.sku}
                    </p>
                    {item.mode === 'rent' && item.rentStart && item.rentEnd ? (
                      <p className="mt-0.5 text-xs font-medium text-primary">
                        Sewa {item.rentDays} hari ·{' '}
                        {new Date(item.rentStart).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                        })}{' '}
                        –{' '}
                        {new Date(item.rentEnd).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                        {item.depositLine > 0
                          ? ` · deposit ${rupiah(item.depositLine)}`
                          : ''}
                      </p>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge className="rounded-full bg-surface text-foreground">
                        {modeLabel[item.mode]}
                      </Badge>
                      {item.mode === 'preorder' ? (
                        <Badge className="rounded-full bg-amber-100 text-amber-800">
                          Stok menyusul
                        </Badge>
                      ) : item.stock < item.qty ? (
                        <Badge className="rounded-full bg-sale/10 text-sale">Stok kurang</Badge>
                      ) : null}
                    </div>
                  </div>
                  <p className="shrink-0 text-sm font-semibold">{item.lineTotalLabel}</p>
                </div>

                <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                  <div className="flex items-center gap-1 rounded-full border border-border bg-surface p-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Kurangi jumlah"
                      className="size-7 rounded-full"
                      disabled={updateMutation.isPending}
                      onClick={() =>
                        updateMutation.mutate({
                          variantId: item.variantId,
                          mode: item.mode,
                          qty: Math.max(0, item.qty - 1),
                        })
                      }
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">{item.qty}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Tambah jumlah"
                      className="size-7 rounded-full"
                      disabled={
                        updateMutation.isPending ||
                        (item.mode === 'buy' && item.qty >= item.stock)
                      }
                      onClick={() =>
                        updateMutation.mutate({
                          variantId: item.variantId,
                          mode: item.mode,
                          qty: Math.min(99, item.qty + 1),
                        })
                      }
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-sale"
                    onClick={() =>
                      removeMutation.mutate({ variantId: item.variantId, mode: item.mode })
                    }
                  >
                    <Trash2 className="size-3.5" /> Hapus
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <aside className="h-fit rounded-[24px] border border-border/70 bg-card p-5 lg:sticky lg:top-24">
          <h2 className="text-base font-semibold">Ringkasan</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-medium">{rupiah(billableSubtotal)}</dd>
            </div>
            {depositTotal > 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Deposit (dikembalikan)</dt>
                <dd className="font-medium">{rupiah(depositTotal)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Pengiriman</dt>
              <dd className="flex items-center gap-1 text-muted-foreground">
                <Truck className="size-3.5" /> Dihitung di checkout
              </dd>
            </div>
          </dl>

          {rentLines.length > 0 ? (
            <p className="mt-4 rounded-2xl bg-surface p-3 text-xs text-muted-foreground">
              Unit sewa dikunci setelah pesanan dibuat dan dilepas bila pembayaran kedaluwarsa.
            </p>
          ) : null}

          <Button
            className={cn('mt-5 h-11 w-full rounded-full font-semibold')}
            disabled={billable.length === 0}
            onClick={() => void navigate({ to: '/checkout' })}
          >
            Lanjut ke Checkout
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Ongkir dihitung per zona saat checkout.
          </p>
        </aside>
      </div>
    </div>
  )
}

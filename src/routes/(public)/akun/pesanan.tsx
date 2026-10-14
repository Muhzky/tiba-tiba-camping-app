import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { myOrdersOptions } from '#/server/fn/order'
import { repayOrder } from '#/server/fn/checkout'
import { paySnap } from '#/lib/snap'
import { Button } from '#/components/ui/button'
import { ORDER_STATUS_LABEL, ORDER_TYPE_LABEL, orderStatusTone } from '#/lib/order-status'
import { Badge } from '#/components/ui/badge'
import { rupiah } from '#/lib/format'
import { Skeleton } from '#/components/ui/skeleton'

export const Route = createFileRoute('/(public)/akun/pesanan')({
  component: PesananPage,
})

const toneClass: Record<string, string> = {
  pending: 'bg-primary/10 text-primary',
  success: 'bg-support/20 text-support-ink',
  info: 'bg-info/10 text-info',
  destructive: 'bg-sale/10 text-sale',
}

const TABS = [
  { key: 'semua', label: 'Semua' },
  { key: 'buy', label: 'Beli' },
  { key: 'rent', label: 'Sewa' },
  { key: 'preorder', label: 'PO' },
] as const

function PesananPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('semua')
  const { data, isLoading } = useQuery(myOrdersOptions)
  const queryClient = useQueryClient()
  const repay = useServerFn(repayOrder)
  const repayMutation = useMutation({
    mutationFn: (orderId: string) => repay({ data: orderId }),
    onSuccess: async (result) => {
      if (!result.snapToken) {
        toast.error('Gagal menyiapkan pembayaran.', {
          description: result.snapError ?? undefined,
        })
        return
      }
      try {
        await paySnap(result.snapToken)
        toast.success('Pembayaran diterima! Pesananmu sedang diproses.')
      } catch {
        toast.info('Pembayaran ditutup — lanjutkan lewat tombol bayar ulang.')
      }
      await queryClient.invalidateQueries({ queryKey: myOrdersOptions.queryKey })
    },
    onError: () => toast.error('Gagal memulai pembayaran ulang.'),
  })

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Riwayat Pesanan</h1>
      <p className="mt-1 text-sm text-muted-foreground">Status pembelian, sewa, dan pre-order kamu.</p>

      {isLoading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex gap-1 rounded-full bg-surface p-1" role="tablist" aria-label="Filter pesanan">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === t.key
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground/70 hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : (data ?? []).filter((o) => tab === 'semua' || o.type === tab).length ? (
        <div className="mt-6 space-y-3">
          {(data ?? [])
            .filter((o) => tab === 'semua' || o.type === tab)
            .map((order) => (
            <div
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4"
            >
              <div>
                <p className="font-mono text-sm font-semibold">{order.code}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {ORDER_TYPE_LABEL[order.type] ?? order.type} · {order.itemCount} item ·{' '}
                  {new Date(order.createdAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
                {order.rentStart && order.rentEnd ? (
                  <p className="mt-0.5 text-xs font-medium text-primary">
                    Periode sewa:{' '}
                    {new Date(order.rentStart).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    –{' '}
                    {new Date(order.rentEnd).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <Badge className={toneClass[orderStatusTone(order.status)]} variant="outline">
                  {ORDER_STATUS_LABEL[order.status] ?? order.status}
                </Badge>
                <span className="text-sm font-semibold">{rupiah(order.grandTotal)}</span>
                {order.status === 'pending_payment' ? (
                  <Button
                    size="sm"
                    className="rounded-full"
                    disabled={repayMutation.isPending}
                    onClick={() => repayMutation.mutate(order.id)}
                  >
                    Bayar Sekarang
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-[24px] border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
          Belum ada pesanan. Gear pertamamu menunggu di katalog.
        </div>
      )}
    </div>
  )
}

import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { Receipt } from 'lucide-react'
import { myOrdersOptions } from '#/server/fn/order'
import { repayOrder } from '#/server/fn/checkout'
import { paySnap } from '#/lib/snap'
import { Button } from '#/components/ui/button'
import {
  ORDER_STATUS_LABEL,
  ORDER_TYPE_LABEL,
  orderStatusTone,
} from '#/lib/order-status'
import { Badge } from '#/components/ui/badge'
import { rupiah } from '#/lib/format'
import { Skeleton } from '#/components/ui/skeleton'
import { cn } from 'cn'
import {
  AccountEmptyState,
  AccountPageHeader,
  accountCard,
  statusToneBadge,
} from '#/components/site/AccountUI'

export const Route = createFileRoute('/(public)/akun/pesanan')({
  component: PesananPage,
})

const TABS = [
  { key: 'semua', label: 'Semua' },
  { key: 'buy', label: 'Beli' },
  { key: 'rent', label: 'Sewa' },
  { key: 'preorder', label: 'PO' },
] as const

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

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
      await queryClient.invalidateQueries({
        queryKey: myOrdersOptions.queryKey,
      })
    },
    onError: () => toast.error('Gagal memulai pembayaran ulang.'),
  })

  const orders = data ?? []
  const filtered = orders.filter(
    (order) => tab === 'semua' || order.type === tab,
  )

  return (
    <div className="flex flex-col gap-7">
      <AccountPageHeader
        title="Riwayat Pesanan"
        description="Status pembelian, sewa, dan pre-order kamu."
      />

      <div
        className="flex w-fit flex-wrap gap-1 rounded-full border border-border/60 bg-surface/60 p-1"
        role="tablist"
        aria-label="Filter pesanan"
      >
        {TABS.map((item) => {
          const active = tab === item.key
          const count = orders.filter(
            (order) => item.key === 'semua' || order.type === item.key,
          ).length
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-200',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-card hover:text-foreground',
              )}
            >
              {item.label}
              <span
                className={cn(
                  'text-[10px] tabular-nums',
                  active
                    ? 'text-primary-foreground/70'
                    : 'text-muted-foreground/80',
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filtered.map((order) => {
            const tone = orderStatusTone(order.status)
            return (
              <article
                key={order.id}
                className={cn(
                  accountCard,
                  'flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-4 transition duration-200 hover:shadow-md',
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-semibold tracking-tight">
                      {order.code}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn(
                        statusToneBadge[tone],
                        'h-5 rounded-full px-2 text-[10px] font-medium',
                      )}
                    >
                      {ORDER_STATUS_LABEL[order.status] ?? order.status}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {ORDER_TYPE_LABEL[order.type] ?? order.type} ·{' '}
                    {order.itemCount} item · {formatDate(order.createdAt)}
                  </p>
                  {order.rentStart && order.rentEnd ? (
                    <p className="mt-1 text-xs font-medium">
                      Periode sewa: {formatDate(order.rentStart)} –{' '}
                      {formatDate(order.rentEnd)}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums">
                    {rupiah(order.grandTotal)}
                  </span>
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
              </article>
            )
          })}
        </div>
      ) : (
        <AccountEmptyState
          icon={Receipt}
          title={
            tab === 'semua'
              ? 'Belum ada pesanan'
              : 'Tidak ada pesanan di kategori ini'
          }
          description={
            tab === 'semua'
              ? 'Gear pertamamu menunggu di katalog.'
              : 'Coba pilih kategori lain untuk melihat pesananmu.'
          }
          action={
            tab === 'semua' ? (
              <Button asChild className="rounded-full">
                <Link to="/katalog">Jelajahi katalog</Link>
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  )
}

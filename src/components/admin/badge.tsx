import type { ReactNode } from 'react'
import { ORDER_STATUS_LABEL, orderStatusTone } from '#/lib/order-status'
import { cn } from '#/lib/utils'

/**
 * Badge status — monokrom secara default; nuansa warna hanya untuk status
 * transaksi (sukses/gagal/tunggak) agar operator cepat membaca.
 */
export type BadgeTone = 'primary' | 'success' | 'warning' | 'danger' | 'info'

const STATUS_TONE: Record<string, BadgeTone> = {
  pending: 'warning',
  success: 'success',
  info: 'info',
  destructive: 'danger',
}

export function StatusBadge({
  tone,
  soft = true,
  children,
  className,
}: {
  tone: BadgeTone | 'neutral'
  soft?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn('badge', soft && 'badge--soft', tone !== 'neutral' && `badge--${tone}`, className)}>
      {children}
    </span>
  )
}

/** Badge status order — label & nuansa dari `lib/order-status`. */
export function OrderStatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[orderStatusTone(status)] ?? 'neutral'
  return <StatusBadge tone={tone}>{ORDER_STATUS_LABEL[status] ?? status}</StatusBadge>
}

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from 'cn'
import type { StatusTone } from '#/lib/order-status'

/**
 * Kelas permukaan kartu akun — satu bahasa visual untuk seluruh area /akun:
 * kanvas abu lembut, kartu putih membulat, garis tipis, bayangan sangat halus.
 */
export const accountCard =
  'rounded-2xl border border-border/60 bg-card shadow-sm'

/** Warna badge status pesanan (menyamai palet intent di halaman publik lain). */
export const statusToneBadge: Record<StatusTone, string> = {
  pending: 'border-transparent bg-amber-100 text-amber-800',
  success: 'border-transparent bg-emerald-100 text-emerald-800',
  info: 'border-transparent bg-sky-100 text-sky-800',
  destructive: 'border-transparent bg-sale/10 text-sale',
}

export function AccountPageHeader({
  eyebrow = 'Akun saya',
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string
  title: string
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-start justify-between gap-4',
        className,
      )}
    >
      <div className="max-w-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  )
}

export function AccountSection({
  id,
  title,
  description,
  action,
  className,
  children,
}: {
  id?: string
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={cn('flex flex-col gap-3', className)}
      aria-labelledby={id}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={id} className="text-sm font-semibold tracking-tight">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function AccountEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/70 bg-card/60 px-6 py-10 text-center',
        className,
      )}
    >
      <span className="grid size-11 place-items-center rounded-full bg-surface text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

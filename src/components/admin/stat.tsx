import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '#/lib/utils'

/**
 * Kartu ringkas gaya dashboard (icon-box + angka + label eyebrow).
 */
export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = 'primary',
}: {
  label: string
  value: ReactNode
  icon: LucideIcon
  hint?: ReactNode
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
}) {
  const Icon = icon
  return (
    <div className="card h-full">
      <div className="card__body flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <span className={cn('icon-box icon-box--lg', `icon-box--${tone}`)}>
            <Icon aria-hidden="true" />
          </span>
          {hint}
        </div>
        <div className="admin-stat">
          <div className="admin-stat__value">{value}</div>
          <div className="admin-stat__label">{label}</div>
        </div>
      </div>
    </div>
  )
}

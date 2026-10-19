import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/**
 * Empty state Stisla v3 (`.empty-state`) — dipakai saat tabel/daftar kosong.
 */
export function EmptyState({
  icon,
  title,
  text,
  action,
  size,
}: {
  icon: LucideIcon
  title: string
  text?: string
  action?: ReactNode
  size?: 'sm'
}) {
  const Icon = icon
  return (
    <div className={size === 'sm' ? 'empty-state empty-state--sm' : 'empty-state'}>
      <span className="empty-state__media">
        <Icon aria-hidden="true" />
      </span>
      <h3 className="empty-state__title">{title}</h3>
      {text ? <p className="empty-state__text">{text}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  )
}

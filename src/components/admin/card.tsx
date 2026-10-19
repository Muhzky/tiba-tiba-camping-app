import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

/**
 * Kartu Stisla v3 (`.card`): header judul + aksi opsional, badan, footer opsional.
 */
export function AdminCard({
  title,
  actions,
  footer,
  headerAlt = false,
  className,
  bodyClassName,
  children,
}: {
  title?: ReactNode
  actions?: ReactNode
  footer?: ReactNode
  /** Header bertipografi tabel (`.card__header--alt`) — dipakai untuk toolbar di atas tabel. */
  headerAlt?: boolean
  className?: string
  bodyClassName?: string
  children?: ReactNode
}) {
  const hasHeader = title !== undefined || actions !== undefined
  return (
    <div className={cn('card', className)}>
      {hasHeader ? (
        <div className={cn('card__header', headerAlt && 'card__header--alt')}>
          {title !== undefined ? <span className="card__title">{title}</span> : null}
          {actions !== undefined ? <div className="ms-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children !== undefined ? <div className={cn('card__body', bodyClassName)}>{children}</div> : null}
      {footer !== undefined ? <div className="card__footer">{footer}</div> : null}
    </div>
  )
}

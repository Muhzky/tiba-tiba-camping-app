import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

export type BreadcrumbItem = { label: string; to?: string }

/**
 * Bingkai halaman admin (Stisla v3 `.page`): header dengan breadcrumb, judul,
 * deskripsi, dan slot aksi; badan berisi `.page__section`.
 */
export function AdminPage({
  title,
  description,
  breadcrumb,
  actions,
  children,
}: {
  title: string
  description?: string
  breadcrumb?: BreadcrumbItem[]
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="page admin-content__container">
      <header className="page__header">
        <div className="page__headline">
          {breadcrumb && breadcrumb.length > 0 ? (
            <nav aria-label="breadcrumb">
              <ol className="breadcrumb">
                {breadcrumb.map((item, index) => {
                  const isLast = index === breadcrumb.length - 1
                  return (
                    <li key={`${item.label}-${index}`} className="breadcrumb__item" aria-current={isLast ? 'page' : undefined}>
                      {item.to && !isLast ? <Link to={item.to}>{item.label}</Link> : item.label}
                    </li>
                  )
                })}
              </ol>
            </nav>
          ) : null}
          <h1 className="page__title">{title}</h1>
          {description ? <p className="page__description">{description}</p> : null}
        </div>
        {actions ? <div className="page__action">{actions}</div> : null}
      </header>
      <div className="page__body">{children}</div>
    </div>
  )
}

/** Satu blok di dalam badan halaman. */
export function AdminSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={className ? `page__section ${className}` : 'page__section'}>
      {title || actions ? (
        <div className="page__section-header">
          <div className="flex flex-col gap-1">
            {title ? <h2 className="page__section-title">{title}</h2> : null}
            {description ? <p className="page__section-description">{description}</p> : null}
          </div>
          {actions ? <div className="page__action">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

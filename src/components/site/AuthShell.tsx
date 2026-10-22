import type { ReactNode } from 'react'

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 pb-24 pt-35 md:pt-45">
      <div className="rounded-[28px] border border-border/70 bg-card p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        {children}
      </div>
    </div>
  )
}

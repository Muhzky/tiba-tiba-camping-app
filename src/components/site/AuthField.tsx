import { useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '#/lib/utils'
import { Input } from '#/components/ui/input'

type AuthFieldProps = React.ComponentProps<typeof Input> & {
  icon: LucideIcon
  trailing?: React.ReactNode
}

export function AuthField({
  icon: Icon,
  trailing,
  className,
  ...props
}: AuthFieldProps) {
  return (
    <div className="relative">
      <Icon
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        {...props}
        className={cn(
          'h-11 rounded-2xl border-transparent bg-surface/70 pl-10 text-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:border-foreground/20 focus-visible:bg-background',
          trailing ? 'pr-11' : 'pr-3.5',
          className,
        )}
      />
      {trailing}
    </div>
  )
}

type PasswordFieldProps = React.ComponentProps<typeof Input>

export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <AuthField
      {...props}
      icon={Lock}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      }
    />
  )
}

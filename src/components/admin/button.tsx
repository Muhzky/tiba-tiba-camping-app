import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '#/lib/utils'

/**
 * Tombol gaya Stisla v3 (class BEM `.button--*`) dalam satu tempat.
 * Dipakai <button> maupun <Link> lewat `buttonClass()`.
 */
export type AdminButtonVariant =
  | 'primary'
  | 'neutral'
  | 'outline'
  | 'ghost'
  | 'soft'
  | 'tertiary'
  | 'danger'

export type AdminButtonSize = 'sm' | 'md' | 'lg'

export function buttonClass({
  variant = 'neutral',
  size,
  iconOnly = false,
  block = false,
  className,
}: {
  variant?: AdminButtonVariant
  size?: AdminButtonSize
  iconOnly?: boolean
  block?: boolean
  className?: string
} = {}): string {
  return cn(
    'button',
    variant === 'primary' && 'button--primary',
    variant === 'neutral' && 'button--neutral',
    variant === 'outline' && 'button--neutral button--outline',
    variant === 'ghost' && 'button--ghost button--neutral',
    variant === 'soft' && 'button--soft',
    variant === 'tertiary' && 'button--tertiary',
    variant === 'danger' && 'button--danger',
    size === 'sm' && 'button--sm',
    size === 'lg' && 'button--lg',
    iconOnly && 'button--icon-only',
    block && 'button--block',
    className,
  )
}

type AdminButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AdminButtonVariant
  size?: AdminButtonSize
  iconOnly?: boolean
  block?: boolean
  children?: ReactNode
}

export function AdminButton({
  variant = 'neutral',
  size,
  iconOnly = false,
  block = false,
  className,
  children,
  type = 'button',
  ...rest
}: AdminButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, iconOnly, block, className })}
      {...rest}
    >
      {children}
    </button>
  )
}

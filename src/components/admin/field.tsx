import { Search } from 'lucide-react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '#/lib/utils'

/**
 * Field Stisla v3 (`.field`) — label + kontrol + deskripsi/error.
 * Kontrol yang dipakai: `.input`, `.textarea`, `.select`, `.switch`, `.checkbox`.
 */
export function Field({
  label,
  htmlFor,
  required = false,
  description,
  error,
  className,
  children,
}: {
  label?: ReactNode
  htmlFor?: string
  required?: boolean
  description?: ReactNode
  error?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <div className={className ? `field ${className}` : 'field'}>
      {label !== undefined ? (
        <label className="field__label" htmlFor={htmlFor}>
          {label}
          {required ? <span aria-hidden="true"> *</span> : null}
        </label>
      ) : null}
      {children}
      {description ? <p className="field__description">{description}</p> : null}
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** Input pencarian dengan ikon (`.input-group--search`). */
export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label: string
  className?: string
  disabled?: boolean
}) {
  return (
    <div className={cn('input-group input-group--search', className)}>
      <span className="input-group__text">
        <Search aria-hidden="true" />
      </span>
      <input
        type="search"
        className="input"
        value={value}
        placeholder={placeholder ?? `Cari ${label}…`}
        aria-label={label}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

/** <select> native yang sudah bergaya Stisla (tanpa JS). */
export function SelectInput({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  ariaLabel: string
  className?: string
  disabled?: boolean
}) {
  return (
    <select
      className={cn('select', className)}
      value={value}
      aria-label={ariaLabel}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

/** Sembunyikan label dari layar tetapi tetap untuk screen reader (toolbar tabel). */
export function VisuallyHiddenInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('sr-only', className)} {...rest} />
}

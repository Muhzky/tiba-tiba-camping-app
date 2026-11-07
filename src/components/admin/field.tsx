import { Check, ChevronDown, Search } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { InputHTMLAttributes, KeyboardEvent, ReactNode } from 'react'
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

/**
 * Dropdown bergaya Stisla v3 (select-only combobox).
 *
 * Memakai markup resmi `.select__trigger` / `.select__popup` / `.select__item`
 * dengan state React — tanpa `@stisla/vanilla` (AGENTS.md §2.1 butir 4).
 * Native `<option>` tidak bisa digayakan, jadi popup digambar sendiri.
 */
export function SelectInput({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  disabled,
  placeholder = 'Pilih…',
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  ariaLabel: string
  className?: string
  disabled?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const baseId = useId()
  const listId = `${baseId}-listbox`
  const optionId = (index: number) => `${baseId}-option-${index}`

  const selectedIndex = options.findIndex((option) => option.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined
  const lastIndex = options.length - 1

  // Buka: sorotan mulai dari nilai terpilih.
  useEffect(() => {
    if (open) setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
  }, [open, selectedIndex])

  // Klik di luar menutup popup.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // Sorotan keyboard selalu terlihat di dalam daftar.
  useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  const choose = (index: number) => {
    if (options.length === 0) return
    onChange(options[index].value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (!open) setOpen(true)
        else setActiveIndex((index) => (index >= lastIndex ? 0 : index + 1))
        return
      case 'ArrowUp':
        event.preventDefault()
        if (!open) setOpen(true)
        else setActiveIndex((index) => (index <= 0 ? lastIndex : index - 1))
        return
      case 'Home':
        if (!open) return
        event.preventDefault()
        setActiveIndex(0)
        return
      case 'End':
        if (!open) return
        event.preventDefault()
        setActiveIndex(lastIndex)
        return
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (open) choose(activeIndex)
        else setOpen(true)
        return
      case 'Escape':
        if (!open) return
        event.preventDefault()
        setOpen(false)
        return
      case 'Tab':
        setOpen(false)
        return
      default: {
        // Type-ahead: lompat ke opsi pertama yang berawalan huruf yang ditekan.
        if (!open || event.key.length !== 1 || event.ctrlKey || event.metaKey) return
        const char = event.key.toLowerCase()
        const start = activeIndex + 1
        const ordered = [...options.slice(start), ...options.slice(0, start)]
        const found = ordered.findIndex((option) => option.label.toLowerCase().startsWith(char))
        if (found === -1) return
        setActiveIndex((start + found) % options.length)
      }
    }
  }

  return (
    <div ref={rootRef} className={cn('admin-select', className)}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? optionId(activeIndex) : undefined}
        disabled={disabled}
        className="select select__trigger admin-select__trigger"
        onClick={() => setOpen((state) => !state)}
        onKeyDown={onKeyDown}
        title={selected?.label}
      >
        <span className="select__value" data-placeholder={placeholder}>
          {selected?.label ?? ''}
        </span>
        <ChevronDown className="admin-select__chevron" aria-hidden="true" />
      </button>
      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="select__popup admin-select__popup"
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={optionId(index)}
              role="option"
              aria-selected={option.value === value}
              data-index={index}
              data-highlighted={index === activeIndex ? '' : undefined}
              className="select__item admin-select__item"
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
            >
              <span className="select__value">{option.label}</span>
              <span className="select__indicator" aria-hidden="true">
                <Check />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** Sembunyikan label dari layar tetapi tetap untuk screen reader (toolbar tabel). */
export function VisuallyHiddenInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('sr-only', className)} {...rest} />
}

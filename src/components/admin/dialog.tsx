import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { AdminButton } from './button'
import { cn } from '#/lib/utils'

/**
 * Dialog konfirmasi Stisla v3 (`.dialog`) yang dikendalikan React:
 * fokus dipindahkan ke dialog saat dibuka dan dikembalikan saat ditutup,
 * Escape menutup, backdrop bisa diklik. Markup & class tetap milik Stisla.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  icon,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  tone = 'neutral',
  busy = false,
  onConfirm,
  onClose,
  footer,
}: {
  open: boolean
  title: string
  description?: string
  icon?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'neutral' | 'danger'
  busy?: boolean
  onConfirm?: () => void
  onClose: () => void
  footer?: ReactNode
}) {
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = panelRef.current
    const focusable = panel?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    const firstFocusable = focusable ? focusable.item(0) : null
    firstFocusable?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (items.length === 0) return
      const first = items.find(Boolean)
      const last = items.at(-1)
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      restoreRef.current?.focus()
    }
  }, [open, onClose])

  return (
    <div
      className="dialog dialog--sm"
      data-state={open ? 'open' : 'closed'}
      role={tone === 'danger' ? 'alertdialog' : 'dialog'}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      aria-hidden={!open}
      tabIndex={-1}
    >
      <div className="dialog__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="dialog__panel" ref={panelRef}>
        <div className="dialog__content">
          <button type="button" className="dialog__close" onClick={onClose} aria-label="Tutup">
            <X aria-hidden="true" />
          </button>
          <div className={cn('dialog__body', !icon && 'pt-4')}>
            {icon ? <div className="mb-3 flex justify-center">{icon}</div> : null}
            <h3 className="dialog__title" id={titleId}>
              {title}
            </h3>
            {description ? (
              <p className="text-muted-foreground" id={descId}>
                {description}
              </p>
            ) : null}
          </div>
          <div className="dialog__footer justify-center">
            {footer ?? (
              <>
                <AdminButton variant="ghost" onClick={onClose} disabled={busy}>
                  {cancelLabel}
                </AdminButton>
                <AdminButton
                  variant="primary"
                  onClick={onConfirm}
                  disabled={busy}
                >
                  {busy ? 'Memproses…' : confirmLabel}
                </AdminButton>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

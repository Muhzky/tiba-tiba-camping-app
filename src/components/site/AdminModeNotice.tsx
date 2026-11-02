import { Link } from '@tanstack/react-router'
import { ShieldAlert } from 'lucide-react'
import { Button } from '#/components/ui/button'

/**
 * Halaman penuh untuk rute pelanggan (/keranjang, /checkout) saat admin
 * membukanya langsung lewat URL.
 */
export function AdminModeNotice({
  title,
  description,
  onClearCart,
  clearing = false,
}: {
  title: string
  description: string
  onClearCart?: () => void
  clearing?: boolean
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-40 text-center md:px-8">
      <div className="grid size-16 place-items-center rounded-full bg-surface text-primary">
        <ShieldAlert className="size-7" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Button asChild className="rounded-full">
          <Link to="/admin/pos">Buka POS</Link>
        </Button>
        <Button variant="outline" asChild className="rounded-full">
          <Link to="/admin">Kembali ke dashboard</Link>
        </Button>
        {onClearCart ? (
          <Button
            variant="ghost"
            className="rounded-full text-muted-foreground"
            disabled={clearing}
            onClick={onClearCart}
          >
            {clearing ? 'Mengosongkan…' : 'Kosongkan keranjang'}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

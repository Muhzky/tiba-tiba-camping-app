import { Link } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from 'cn'
import { cartOptions, quickAddToCart } from '#/server/fn/cart'
import type { ProductCardData } from '#/server/fn/product'

export function ProductCard({ product, className }: { product: ProductCardData; className?: string }) {
  const queryClient = useQueryClient()
  const quickAdd = useServerFn(quickAddToCart)
  const mutation = useMutation({
    mutationFn: () => quickAdd({ data: product.id }),
    onSuccess: (cart) => {
      queryClient.setQueryData(cartOptions.queryKey, cart)
      toast.success(`${product.name} masuk keranjang.`)
    },
    onError: () => toast.error('Gagal menambahkan ke keranjang.'),
  })

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-3xl bg-surface transition-transform duration-300 hover:-translate-y-1',
        className,
      )}
    >
      <Link to="/produk/$slug" params={{ slug: product.slug }} className="absolute inset-0 z-10">
        <span className="sr-only">{product.name}</span>
      </Link>

      {product.discountPercent > 0 ? (
        <span className="absolute left-3 top-3 z-20 rounded-full bg-sale px-2.5 py-1 text-xs font-bold text-white">
          -{product.discountPercent}%
        </span>
      ) : null}

      <div className="aspect-square overflow-hidden bg-white/60">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{product.category}</p>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{product.name}</h3>

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            <p className="text-sm font-bold text-sale">{product.priceLabel}</p>
            {product.salePriceLabel ? (
              <p className="text-xs text-muted-foreground line-through">{product.salePriceLabel}</p>
            ) : null}
          </div>

          <button
            type="button"
            aria-label={`Tambah ${product.name} ke keranjang`}
            tabIndex={-1}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            className="relative z-20 grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform duration-300 group-hover:scale-110 active:scale-95"
          >
            <ShoppingBag className="size-4.5" />
          </button>
        </div>

        {product.colors.length > 0 ? (
          <div className="flex items-center gap-1.5" aria-label="Pilihan warna">
            {product.colors.slice(0, 4).map((color) => (
              <span
                key={color.hex}
                className="size-3.5 rounded-full border border-black/10"
                style={{ backgroundColor: color.hex }}
                title={color.name}
              />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}

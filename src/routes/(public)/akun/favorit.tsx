import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { Heart } from 'lucide-react'
import { favoritesOptions, toggleFavorite, favoriteStatusOptions  } from '#/server/fn/account'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'

export const Route = createFileRoute('/(public)/akun/favorit')({
  component: FavoritPage,
})

function FavoritPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery(favoritesOptions)
  const toggle = useServerFn(toggleFavorite)
  const mutation = useMutation({
    mutationFn: (productId: string) => toggle({ data: productId }),
    onSuccess: async (_result, productId) => {
      await queryClient.invalidateQueries({ queryKey: favoritesOptions.queryKey })
      await queryClient.invalidateQueries({ queryKey: favoriteStatusOptions(productId).queryKey })
      toast.success('Favorit diperbarui.')
    },
  })

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Produk Favorit</h1>
      <p className="mt-1 text-sm text-muted-foreground">Gear yang kamu incar, disimpan di sini.</p>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : data?.length ? (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          {data.map((product) => (
            <div
              key={product.id}
              className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card"
            >
              <Link to="/produk/$slug" params={{ slug: product.slug }} className="block">
                <div className="aspect-square overflow-hidden bg-surface">
                  <img
                    src={product.image}
                    alt={product.name}
                    loading="lazy"
                    className="size-full object-cover transition duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-3">
                  <p className="text-xs text-muted-foreground">{product.category}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm font-medium">{product.name}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold">{product.priceLabel}</span>
                    {product.discountPercent > 0 ? (
                      <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                        -{product.discountPercent}%
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Hapus dari favorit"
                className="absolute right-2 top-2 rounded-full bg-background/80 text-sale backdrop-blur hover:text-sale"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(product.id)}
              >
                <Heart className="fill-current" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-[24px] border border-dashed border-border/70 p-10 text-center">
          <Heart className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Belum ada produk favorit.</p>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/katalog">Jelajahi katalog</Link>
          </Button>
        </div>
      )}
    </div>
  )
}

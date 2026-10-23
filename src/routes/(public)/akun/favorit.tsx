import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { Heart } from 'lucide-react'
import {
  favoritesOptions,
  toggleFavorite,
  favoriteStatusOptions,
} from '#/server/fn/account'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Skeleton } from '#/components/ui/skeleton'
import { cn } from 'cn'
import {
  AccountEmptyState,
  AccountPageHeader,
  accountCard,
} from '#/components/site/AccountUI'

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
      await queryClient.invalidateQueries({
        queryKey: favoritesOptions.queryKey,
      })
      await queryClient.invalidateQueries({
        queryKey: favoriteStatusOptions(productId).queryKey,
      })
      toast.success('Favorit diperbarui.')
    },
  })

  const count = data?.length ?? 0

  return (
    <div className="flex flex-col gap-7">
      <AccountPageHeader
        title="Produk Favorit"
        description="Gear yang kamu incar, disimpan di sini."
        actions={
          count > 0 ? (
            <Badge
              variant="outline"
              className="h-6 rounded-full border-border/60 bg-card px-3 text-[11px] font-medium text-muted-foreground"
            >
              {count} produk
            </Badge>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : count ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
          {data?.map((product) => (
            <div
              key={product.id}
              className={cn(
                accountCard,
                'group relative overflow-hidden transition duration-300 hover:-translate-y-0.5 hover:shadow-md',
              )}
            >
              <Link
                to="/produk/$slug"
                params={{ slug: product.slug }}
                className="block"
              >
                <div className="aspect-square overflow-hidden bg-surface">
                  <img
                    src={product.image}
                    alt={product.name}
                    loading="lazy"
                    className="size-full object-cover transition duration-500 group-hover:scale-[1.04]"
                  />
                </div>
                <div className="p-3.5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {product.category}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug">
                    {product.name}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold">
                      {product.priceLabel}
                    </span>
                    {product.discountPercent > 0 ? (
                      <Badge
                        variant="destructive"
                        className="px-1.5 py-0 text-[10px]"
                      >
                        -{product.discountPercent}%
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Hapus ${product.name} dari favorit`}
                className="absolute right-2.5 top-2.5 rounded-full border border-border/60 bg-background/85 text-sale shadow-sm backdrop-blur transition hover:bg-background hover:text-sale"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(product.id)}
              >
                <Heart className="size-4 fill-current" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <AccountEmptyState
          icon={Heart}
          title="Belum ada produk favorit"
          description="Tandai gear incaranmu dengan ikon hati di katalog, lalu temukan semuanya di sini."
          action={
            <Button asChild className="rounded-full">
              <Link to="/katalog">Jelajahi katalog</Link>
            </Button>
          }
        />
      )}
    </div>
  )
}

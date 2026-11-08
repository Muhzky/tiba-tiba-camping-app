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
import {
  AccountEmptyState,
  AccountPageHeader,
} from '#/components/site/AccountUI'
import { ProductCard } from '#/components/site/ProductCard'

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
              className="flex items-center gap-1.5 h-7 rounded-full border border-sale/20 bg-sale/10 px-3 py-0.5 text-xs font-semibold text-sale shadow-sm"
            >
              <Heart className="size-3.5 fill-current" />
              <span>{count} produk favorit</span>
            </Badge>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[420px] rounded-3xl" />
          ))}
        </div>
      ) : count ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {data?.map((product) => (
            <div key={product.id} className="group relative">
              <ProductCard product={product} />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Hapus ${product.name} dari favorit`}
                className="absolute z-30 right-3 top-3 rounded-full border border-border/60 bg-background/90 text-sale shadow-sm backdrop-blur-md transition hover:bg-background hover:text-sale"
                disabled={mutation.isPending}
                onClick={(e) => {
                  e.stopPropagation()
                  mutation.mutate(product.id)
                }}
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

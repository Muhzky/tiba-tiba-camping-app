import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import {
  favoriteStatusOptions,
  favoritesOptions,
  toggleFavorite,
} from '#/server/fn/account'
import { meOptions } from '#/server/fn/auth'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'

export function FavoriteButton({ productId }: { productId: string }) {
  const queryClient = useQueryClient()
  const { data: user } = useQuery(meOptions)
  const { data: favorited } = useQuery(favoriteStatusOptions(productId))
  const toggle = useServerFn(toggleFavorite)

  const mutation = useMutation({
    mutationFn: () => toggle({ data: productId }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: favoriteStatusOptions(productId).queryKey,
      })
      await queryClient.invalidateQueries({ queryKey: favoritesOptions.queryKey })
      toast.success(result.favorited ? 'Ditambahkan ke favorit.' : 'Dihapus dari favorit.')
    },
    onError: () => toast.error('Gagal memperbarui favorit.'),
  })

  if (!user) {
    return (
      <Button variant="outline" size="sm" className="rounded-full" asChild>
        <Link to="/masuk">
          <Heart />
          Simpan ke favorit
        </Link>
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn('rounded-full', favorited && 'border-sale/40 text-sale')}
      disabled={mutation.isPending}
      aria-pressed={favorited === true}
      onClick={() => mutation.mutate()}
    >
      <Heart className={cn(favorited && 'fill-current')} />
      {favorited ? 'Tersimpan' : 'Simpan ke favorit'}
    </Button>
  )
}

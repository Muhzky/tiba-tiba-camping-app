import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { queryKeys } from '#/lib/query-keys'
import { logout, meOptions } from '#/server/fn/auth'
import { clearCart } from '#/server/fn/cart'

/**
 * Logout bersama untuk navbar publik, halaman akun, dan panel admin.
 *
 * Setelah sesi dihapus, query `me` di-invalidate supaya navbar langsung
 * berubah jadi tombol "Masuk", lalu `router.invalidate()` menjalankan ulang
 * loader/beforeLoad. Halaman terproteksi akan mengarahkan ke /masuk lewat
 * guard-nya sendiri; halaman publik tetap di tempat.
 */
export function useLogout() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const signOut = useServerFn(logout)
  const clear = useServerFn(clearCart)

  return useMutation({
    mutationFn: () => signOut(),
    onSuccess: async () => {
      // Keranjang disimpan di cookie browser (bukan di akun), jadi isinya
      // terbawa ke user berikutnya di browser yang sama. Hapus cookie-nya
      // lewat request terpisah: runtime dev hanya mempertahankan satu header
      // Set-Cookie per respons, sehingga tidak bisa digabung dengan logout.
      try {
        await clear()
      } catch {
        // Jangan gagalkan logout hanya karena keranjang gagal direset.
      }
      // Buang seluruh cache milik sesi lama: `me` beserta turunannya (profil,
      // alamat, favorit, preferensi) dan pesanan. Jangan di-invalidate lalu
      // ditunggu — refetch query turunan bisa retry dan menahan redirect.
      queryClient.removeQueries({ queryKey: meOptions.queryKey })
      queryClient.removeQueries({ queryKey: queryKeys.orders.my() })
      // Cache keranjang & checkout ikut dibuang supaya badge navbar dan
      // halaman /keranjang tidak menampilkan isi keranjang sesi sebelumnya.
      queryClient.removeQueries({ queryKey: queryKeys.cart() })
      queryClient.removeQueries({ queryKey: queryKeys.checkout.all() })
      // Guard halaman terproteksi memakai `ensureQueryData`; setelah cache
      // dibuang ia akan fetch ulang, mendapat `null`, lalu redirect ke /masuk.
      // Rekomendasi "Untuk Kamu" kembali ke cold-start (Populer).
      void queryClient.invalidateQueries({
        queryKey: queryKeys.products.all(),
      })
      await router.invalidate()
      toast.success('Kamu sudah keluar.')
    },
    onError: () => {
      toast.error('Gagal keluar. Coba lagi.')
    },
  })
}

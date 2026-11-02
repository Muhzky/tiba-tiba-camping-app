import { useQuery } from '@tanstack/react-query'
import { meOptions } from '#/server/fn/auth'
import { isStaffRole } from './roles'

/**
 * Deteksi admin dari sesi aktif. Dipakai halaman publik untuk
 * menyembunyikan alur belanja pelanggan dan menampilkan dialog mode admin.
 */
export function useIsStaff() {
  const { data: user } = useQuery(meOptions)
  return { user, isStaff: isStaffRole(user?.role) }
}

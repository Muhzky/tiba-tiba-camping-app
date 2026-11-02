import { getSessionUser } from '#/server/fn/auth'
import type { SessionUser } from '#/server/fn/auth'
import { isStaffRole } from '#/lib/roles'

/**
 * Tolak admin dari alur belanja pelanggan. Guest tetap boleh memakai
 * keranjang (cookie), jadi helper ini tidak mewajibkan login.
 */
export async function assertNotStaff(): Promise<void> {
  const user = await getSessionUser()
  if (user && isStaffRole(user.role)) throw new Error('ADMIN_MODE')
}

/** Wajib login sebagai customer (bukan admin). */
export async function requireCustomer(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new Error('UNAUTHORIZED')
  if (isStaffRole(user.role)) throw new Error('ADMIN_MODE')
  return user
}

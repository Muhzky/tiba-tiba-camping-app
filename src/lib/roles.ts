export type UserRole = 'customer' | 'admin'

/** Staff (admin) tidak memakai alur belanja pelanggan; pesanan dibuat lewat POS. */
export function isStaffRole(
  role: string | null | undefined,
): role is 'admin' {
  return role === 'admin'
}

/** Error dari server function saat staff mencoba memakai alur pelanggan. */
export function isAdminModeError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('ADMIN_MODE')
}

/**
 * Tujuan setelah login/daftar. Staff selalu ke panel admin — `?redirect=` ke
 * halaman pelanggan diabaikan, kecuali deep link yang memang di area /admin.
 */
export function postLoginTarget(
  role: string | null | undefined,
  redirect?: string | null,
): string {
  if (isStaffRole(role)) {
    return redirect?.startsWith('/admin') ? redirect : '/admin'
  }
  return redirect ?? '/akun'
}

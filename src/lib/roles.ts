export type UserRole = 'customer' | 'admin' | 'owner'

/** Staff (admin/owner) tidak memakai alur belanja pelanggan; pesanan dibuat lewat POS. */
export function isStaffRole(
  role: string | null | undefined,
): role is 'admin' | 'owner' {
  return role === 'admin' || role === 'owner'
}

/** Error dari server function saat staff mencoba memakai alur pelanggan. */
export function isAdminModeError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('ADMIN_MODE')
}

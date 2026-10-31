import type { SessionUser } from '#/server/fn/auth'

/** Bentuk user dari respons Better Auth (sign-in/sign-up/get-session). */
export type SessionUserSource = {
  id: string
  name: string
  email: string
  phone?: string | null
  image?: string | null
  role?: string | null
  isActive?: boolean | null
}

/**
 * Normalisasi user Better Auth → `SessionUser`. Akun nonaktif dianggap tidak
 * login. Dipakai di server (getSessionUser) dan di klien setelah sign-in agar
 * sesi baru bisa langsung masuk cache tanpa round trip tambahan.
 */
export function toSessionUser(user: SessionUserSource): SessionUser | null {
  if (user.isActive === false) return null
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    image: user.image ?? null,
    role: (user.role ?? 'customer') as SessionUser['role'],
    isActive: true,
  }
}

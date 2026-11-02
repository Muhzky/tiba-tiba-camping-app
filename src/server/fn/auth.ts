import { createServerFn } from '@tanstack/react-start'
import {
  getRequestHeaders,
  setResponseHeader,
} from '@tanstack/react-start/server'
import { queryOptions } from '@tanstack/react-query'
import { auth } from '#/lib/auth'
import { queryKeys } from '#/lib/query-keys'
import { toSessionUser } from '#/lib/session-user'

export type SessionUser = {
  id: string
  name: string
  email: string
  phone: string | null
  image: string | null
  role: 'customer' | 'admin'
  isActive: boolean
}

export const getSessionUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUser | null> => {
    const session = await auth.api.getSession({ headers: getRequestHeaders() })
    if (!session) return null
    return toSessionUser(session.user)
  },
)

export const meOptions = queryOptions({
  queryKey: queryKeys.me(),
  queryFn: () => getSessionUser(),
  staleTime: 30_000,
})

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  const response = await auth.api.signOut({
    headers: getRequestHeaders(),
    asResponse: true,
  })
  // TanStack Start/Nitro di dev hanya mempertahankan satu header Set-Cookie
  // (yang terakhir). Urutkan agar cookie sesi berada di akhir, supaya yang
  // benar-benar terhapus di browser adalah session_token — bukan cuma
  // dont_remember seperti sebelumnya. Di runtime yang mendukung banyak
  // Set-Cookie, ketiganya tetap terkirim.
  const cookies = [...(response.headers.getSetCookie?.() ?? [])].sort(
    (a, b) => cookiePriority(a) - cookiePriority(b),
  )
  if (cookies.length > 0) {
    setResponseHeader('set-cookie', cookies)
  }
  return { ok: true as const }
})

/** Cookie sesi harus dikirim paling akhir (lihat komentar di atas). */
function cookiePriority(cookie: string): number {
  const name = cookie.slice(0, cookie.indexOf('=')).trim().toLowerCase()
  return name.endsWith('session_token') ? 1 : 0
}

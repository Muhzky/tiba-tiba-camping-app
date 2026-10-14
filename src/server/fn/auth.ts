import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { queryOptions } from '@tanstack/react-query'
import { auth } from '#/lib/auth'
import { queryKeys } from '#/lib/query-keys'

export type SessionUser = {
  id: string
  name: string
  email: string
  role: 'customer' | 'admin' | 'owner'
  isActive: boolean
}

export const getSessionUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUser | null> => {
    const session = await auth.api.getSession({ headers: getRequestHeaders() })
    if (!session) return null
    const user: {
      id: string
      name: string
      email: string
      role?: string
      isActive?: boolean
    } = session.user
    const isActive = user.isActive !== false
    if (!isActive) return null
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: (user.role ?? 'customer') as SessionUser['role'],
      isActive,
    }
  },
)

export const meOptions = queryOptions({
  queryKey: queryKeys.me(),
  queryFn: () => getSessionUser(),
  staleTime: 30_000,
})

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  await auth.api.signOut({ headers: getRequestHeaders() })
  return { ok: true as const }
})

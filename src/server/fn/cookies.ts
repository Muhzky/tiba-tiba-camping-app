import { createServerFn } from '@tanstack/react-start'
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'
import { z } from 'zod'

// Cookie helpers as server fns: `@tanstack/react-start/server` may only be
// used lexically inside `.handler()` (build import-protection), so callers
// in cart/checkout must not import it directly.

export const readCookie = createServerFn({ method: 'GET' })
  .validator((name: string) => z.string().min(1).max(80).parse(name))
  .handler(async ({ data: name }) => getCookie(name) ?? null)

const writeInput = z.object({
  name: z.string().min(1).max(80),
  value: z.string().nullable(),
  maxAge: z.number().int().positive().optional(),
})

export const writeCookie = createServerFn({ method: 'POST' })
  .validator((input: z.input<typeof writeInput>) => writeInput.parse(input))
  .handler(async ({ data }) => {
    if (data.value === null) {
      deleteCookie(data.name, { path: '/' })
      return
    }
    setCookie(data.name, data.value, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: data.maxAge,
      secure: process.env.NODE_ENV === 'production',
    })
  })

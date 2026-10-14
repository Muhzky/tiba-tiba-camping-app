import { z } from 'zod'

export const CART_COOKIE = 'ttc_cart'

export const cartLineSchema = z.object({
  variantId: z.uuid(),
  qty: z.number().int().min(1).max(99),
  mode: z.enum(['buy', 'rent', 'preorder']),
  rentStart: z.iso.datetime().optional(),
  rentEnd: z.iso.datetime().optional(),
})

export type CartLine = z.infer<typeof cartLineSchema>

export const cartCookieSchema = z.array(cartLineSchema).max(50)

export function parseCart(raw: string | undefined | null): CartLine[] {
  if (!raw) return []
  try {
    const parsed = cartCookieSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

export function cartKey(line: Pick<CartLine, 'variantId' | 'mode'>) {
  return `${line.variantId}:${line.mode}`
}

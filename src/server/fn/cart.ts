import { createServerFn } from '@tanstack/react-start'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { queryOptions } from '@tanstack/react-query'
import { db } from '#/server/db'
import { productImages, products, productVariants } from '#/server/db/schema'
import { CART_COOKIE, parseCart  } from '#/lib/cart'
import type {CartLine} from '#/lib/cart';
import { queryKeys } from '#/lib/query-keys'
import { imageUrl } from '#/server/fn/product'
import { getSessionUser } from '#/server/fn/auth'
import { recordProductEvent } from '#/server/recommender/profile'
import { readCookie, writeCookie } from '#/server/fn/cookies'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30

export async function readCart(): Promise<CartLine[]> {
  return parseCart(await readCookie({ data: CART_COOKIE }))
}

export async function writeCart(lines: CartLine[]): Promise<void> {
  await writeCookie({
    data: {
      name: CART_COOKIE,
      value: lines.length === 0 ? null : JSON.stringify(lines),
      maxAge: COOKIE_MAX_AGE,
    },
  })
}

export type CartItemView = {
  variantId: string
  mode: 'buy' | 'rent' | 'preorder'
  qty: number
  rentStart: string | null
  rentEnd: string | null
  productId: string
  slug: string
  name: string
  image: string
  colorName: string | null
  sku: string
  stock: number
  unitPrice: number
  unitPriceLabel: string
  lineTotal: number
  lineTotalLabel: string
  isPreorder: boolean
  preorderDpPercent: number | null
  isRentable: boolean
  rentDays: number
  rentPerDay: number
  depositLine: number
}

export type CartView = {
  items: CartItemView[]
  subtotal: number
  subtotalLabel: string
  count: number
}

export async function buildCartView(lines: CartLine[]): Promise<CartView> {
  const variantIds = [...new Set(lines.map((l) => l.variantId))]
  const rows = variantIds.length
    ? await db
        .select({
          variantId: productVariants.id,
          stock: productVariants.stock,
          sku: productVariants.sku,
          colorName: productVariants.colorName,
          productId: products.id,
          slug: products.slug,
          name: products.name,
          salePrice: products.salePrice,
          discountPercent: products.discountPercent,
          isPreorder: products.isPreorder,
          preorderDpPercent: products.preorderDpPercent,
          isRentable: products.isRentable,
          rentPricePerDay: products.rentPricePerDay,
          rentDeposit: products.rentDeposit,
          isActive: products.isActive,
          image: productImages.r2Key,
        })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .leftJoin(
          productImages,
          and(eq(productImages.productId, products.id), eq(productImages.sort, 0)),
        )
        .where(inArray(productVariants.id, variantIds))
    : []

  const byId = new Map(rows.map((r) => [r.variantId, r]))
  const items: CartItemView[] = []

  for (const line of lines) {
    const row = byId.get(line.variantId)
    if (!row || !row.isActive) continue
    const unitPrice = Math.round(row.salePrice - (row.salePrice * row.discountPercent) / 100)
    const rentDays =
      line.mode === 'rent' && line.rentStart && line.rentEnd
        ? Math.max(
            1,
            Math.ceil(
              (new Date(line.rentEnd).getTime() - new Date(line.rentStart).getTime()) /
                86_400_000,
            ),
          )
        : 0
    const rentPerDay = row.rentPricePerDay ?? 0
    const depositLine = line.mode === 'rent' ? (row.rentDeposit ?? 0) * line.qty : 0
    const lineTotal =
      line.mode === 'rent' ? rentPerDay * rentDays * line.qty : unitPrice * line.qty
    items.push({
      variantId: line.variantId,
      mode: line.mode,
      qty: line.qty,
      rentStart: line.rentStart ?? null,
      rentEnd: line.rentEnd ?? null,
      productId: row.productId,
      slug: row.slug,
      name: row.name,
      image: row.image ? imageUrl(row.image) : '/images/placeholder-product.svg',
      colorName: row.colorName,
      sku: row.sku,
      stock: row.stock,
      unitPrice: line.mode === 'rent' ? rentPerDay : unitPrice,
      unitPriceLabel: new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }).format(line.mode === 'rent' ? rentPerDay : unitPrice),
      lineTotal,
      lineTotalLabel: new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }).format(lineTotal),
      isPreorder: row.isPreorder,
      preorderDpPercent: row.preorderDpPercent,
      isRentable: row.isRentable,
      rentDays,
      rentPerDay,
      depositLine,
    })
  }

  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0)
  return {
    items,
    subtotal,
    subtotalLabel: new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(subtotal),
    count: items.reduce((sum, i) => sum + i.qty, 0),
  }
}

export const getCart = createServerFn({ method: 'GET' }).handler(
  async (): Promise<CartView> => buildCartView(await readCart()),
)

export const cartOptions = queryOptions({
  queryKey: queryKeys.cart(),
  queryFn: () => getCart(),
  staleTime: 0,
})

const addInput = z
  .object({
    variantId: z.uuid(),
    mode: z.enum(['buy', 'rent', 'preorder']),
    qty: z.number().int().min(1).max(99).default(1),
    rentStart: z.iso.datetime().optional(),
    rentEnd: z.iso.datetime().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode !== 'rent') return
    if (!value.rentStart || !value.rentEnd) {
      ctx.addIssue({
        code: 'custom',
        path: ['rentStart'],
        message: 'Periode sewa wajib diisi',
      })
      return
    }
    if (new Date(value.rentEnd) <= new Date(value.rentStart)) {
      ctx.addIssue({
        code: 'custom',
        path: ['rentEnd'],
        message: 'Tanggal selesai harus setelah tanggal mulai',
      })
    }
  })

export const addToCart = createServerFn({ method: 'POST' })
  .validator(addInput)
  .handler(async ({ data }): Promise<CartView> => {
    const [variant] = await db
      .select({ id: productVariants.id, productId: productVariants.productId })
      .from(productVariants)
      .where(eq(productVariants.id, data.variantId))
      .limit(1)
    if (!variant) throw new Error('VARIAN_TIDAK_DITEMUKAN')

    const lines = await readCart()
    const sameLine = (l: CartLine) =>
      l.variantId === data.variantId &&
      l.mode === data.mode &&
      l.rentStart === data.rentStart &&
      l.rentEnd === data.rentEnd
    const existing = lines.find(sameLine)
    if (existing) {
      existing.qty = Math.min(99, existing.qty + data.qty)
    } else {
      lines.push({
        variantId: data.variantId,
        mode: data.mode,
        qty: data.qty,
        rentStart: data.rentStart,
        rentEnd: data.rentEnd,
      })
    }
    await writeCart(lines)
    const user = await getSessionUser()
    void recordProductEvent(variant.productId, 'add_cart', user?.id)
    return buildCartView(lines)
  })

export const quickAddToCart = createServerFn({ method: 'POST' })
  .validator((productId: string) => productId)
  .handler(async ({ data }): Promise<CartView> => {
    const [variant] = await db
      .select({ id: productVariants.id, stock: productVariants.stock })
      .from(productVariants)
      .where(eq(productVariants.productId, data))
      .orderBy(sql`stock desc`)
      .limit(1)
    if (!variant) throw new Error('PRODUK_TANPA_VARIAN')

    const lines = await readCart()
    const mode = 'buy'
    const existing = lines.find(
      (l) => l.variantId === variant.id && l.mode === mode,
    )
    if (existing) {
      existing.qty = Math.min(99, existing.qty + 1)
    } else {
      lines.push({ variantId: variant.id, mode, qty: 1 })
    }
    await writeCart(lines)
    const user = await getSessionUser()
    void recordProductEvent(data, 'add_cart', user?.id)
    return buildCartView(lines)
  })

const updateInput = z.object({
  variantId: z.uuid(),
  mode: z.enum(['buy', 'rent', 'preorder']),
  qty: z.number().int().min(0).max(99),
})

export const updateCartQty = createServerFn({ method: 'POST' })
  .validator(updateInput)
  .handler(async ({ data }): Promise<CartView> => {
    let lines = await readCart()
    if (data.qty === 0) {
      lines = lines.filter(
        (l) => !(l.variantId === data.variantId && l.mode === data.mode),
      )
    } else {
      for (const line of lines) {
        if (line.variantId === data.variantId && line.mode === data.mode) {
          line.qty = data.qty
        }
      }
    }
    await writeCart(lines)
    return buildCartView(lines)
  })

const removeInput = z.object({
  variantId: z.uuid(),
  mode: z.enum(['buy', 'rent', 'preorder']),
})

export const removeCartItem = createServerFn({ method: 'POST' })
  .validator(removeInput)
  .handler(async ({ data }): Promise<CartView> => {
    const lines = (await readCart()).filter(
      (l) => !(l.variantId === data.variantId && l.mode === data.mode),
    )
    await writeCart(lines)
    return buildCartView(lines)
  })

export const clearCart = createServerFn({ method: 'POST' }).handler(
  async (): Promise<CartView> => {
    await writeCart([])
    return { items: [], subtotal: 0, subtotalLabel: 'Rp0', count: 0 }
  },
)

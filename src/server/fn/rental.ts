import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import { and, asc, eq, gt, inArray, lt, sql } from 'drizzle-orm'
import { db } from '#/server/db'
import {
  categories,
  orderItems,
  orders,
  productImages,
  productVariants,
  products,
  rentalUnits,
} from '#/server/db/schema'
import { rentalDays, rentalDeposit } from '#/lib/order-totals'
import { queryKeys } from '#/lib/query-keys'
import { rupiah } from '#/lib/format'
import { fetchColors, imageUrl } from '#/server/fn/product'

export const rentalAvailabilitySchema = z
  .object({
    productId: z.uuid(),
    start: z.iso.datetime(),
    end: z.iso.datetime(),
  })
  .refine((v) => new Date(v.end) > new Date(v.start), {
    message: 'Tanggal selesai harus setelah tanggal mulai',
    path: ['end'],
  })

export type RentalAvailability = {
  available: boolean
  days: number
  rentPerDay: number
  rentTotal: number
  deposit: number
  freeUnits: number
}

export const ACTIVE_RENTAL_STATUSES = [
  'pending_payment',
  'paid',
  'processing',
  'shipped',
  'ready_pickup',
  'rented',
  'overdue',
] as const

export async function getRentalAvailability(
  input: z.infer<typeof rentalAvailabilitySchema>,
): Promise<RentalAvailability | null> {
  const [product] = await db
    .select({
      id: products.id,
      rentPricePerDay: products.rentPricePerDay,
      isRentable: products.isRentable,
    })
    .from(products)
    .where(eq(products.id, input.productId))
    .limit(1)

  if (!product?.isRentable || !product.rentPricePerDay) return null

  const unitRows = await db
    .select({ id: rentalUnits.id, status: rentalUnits.status })
    .from(rentalUnits)
    .innerJoin(productVariants, eq(rentalUnits.variantId, productVariants.id))
    .where(eq(productVariants.productId, product.id))

  const start = new Date(input.start)
  const end = new Date(input.end)
  const days = rentalDays(start, end)

  const unitIds = unitRows.map((u) => u.id)
  let occupied = new Set<string>()
  if (unitIds.length) {
    const occupiedRows = await db
      .select({ unit: orderItems.rentalUnitId })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          inArray(orderItems.rentalUnitId, unitIds),
          inArray(orders.status, [...ACTIVE_RENTAL_STATUSES]),
          lt(orderItems.rentStart, end),
          gt(orderItems.rentEnd, start),
        ),
      )
    occupied = new Set(
      occupiedRows.map((r) => r.unit).filter((v): v is string => Boolean(v)),
    )
  }

  const freeUnits = unitRows.filter(
    (u) => u.status !== 'maintenance' && !occupied.has(u.id),
  ).length

  return {
    available: freeUnits > 0,
    days,
    rentPerDay: product.rentPricePerDay,
    rentTotal: product.rentPricePerDay * days,
    deposit: rentalDeposit(product.rentPricePerDay * days),
    freeUnits,
  }
}

export const checkRentalAvailability = createServerFn({ method: 'POST' })
  .validator((input: z.infer<typeof rentalAvailabilitySchema>) =>
    rentalAvailabilitySchema.parse(input),
  )
  .handler(({ data }) => getRentalAvailability(data))

export type RentalCatalogItem = {
  id: string
  slug: string
  name: string
  categoryName: string
  categorySlug: string
  image: string
  rentPerDay: number
  rentPerDayLabel: string
  stock: number
  colors: Array<{ name: string; hex: string }>
}

export type RentalCatalogCategory = {
  name: string
  slug: string
  count: number
  minRentPerDay: number
}

export type RentalCatalog = {
  items: Array<RentalCatalogItem>
  categories: Array<RentalCatalogCategory>
  total: number
  totalStock: number
  minRentPerDay: number
}

export const getRentalCatalog = createServerFn({ method: 'GET' }).handler(
  async (): Promise<RentalCatalog> => {
    const rows = await db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        categoryName: categories.name,
        categorySlug: categories.slug,
        image: productImages.r2Key,
        rentPerDay: sql<number>`coalesce(${products.rentPricePerDay}, 0)::int`,
      })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(
        productImages,
        and(
          eq(productImages.productId, products.id),
          eq(productImages.sort, 0),
        ),
      )
      .where(
        and(
          eq(products.isActive, true),
          eq(products.isRentable, true),
          gt(products.rentPricePerDay, 0),
        ),
      )
      .orderBy(asc(products.rentPricePerDay), asc(products.name))

    const stockRows = await db
      .select({
        productId: productVariants.productId,
        stock: sql<number>`count(${rentalUnits.id})::int`,
      })
      .from(rentalUnits)
      .innerJoin(productVariants, eq(rentalUnits.variantId, productVariants.id))
      .where(sql`${rentalUnits.status} <> 'maintenance'`)
      .groupBy(productVariants.productId)

    const stockByProduct = new Map(
      stockRows.map((row) => [row.productId, row.stock]),
    )
    const colorByProduct = await fetchColors(rows.map((row) => row.id))

    const items: Array<RentalCatalogItem> = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      categoryName: row.categoryName,
      categorySlug: row.categorySlug,
      image: row.image
        ? imageUrl(row.image)
        : '/images/placeholder-product.svg',
      rentPerDay: row.rentPerDay,
      rentPerDayLabel: rupiah(row.rentPerDay),
      stock: stockByProduct.get(row.id) ?? 0,
      colors: colorByProduct.get(row.id) ?? [],
    }))

    const categoryMap = new Map<string, RentalCatalogCategory>()
    for (const item of items) {
      const existing = categoryMap.get(item.categorySlug)
      if (existing) {
        existing.count += 1
        existing.minRentPerDay = Math.min(
          existing.minRentPerDay,
          item.rentPerDay,
        )
      } else {
        categoryMap.set(item.categorySlug, {
          name: item.categoryName,
          slug: item.categorySlug,
          count: 1,
          minRentPerDay: item.rentPerDay,
        })
      }
    }

    return {
      items,
      categories: [...categoryMap.values()].sort((a, b) =>
        a.name.localeCompare(b.name, 'id'),
      ),
      total: items.length,
      totalStock: items.reduce((sum, item) => sum + item.stock, 0),
      minRentPerDay: items.reduce(
        (min, item) => Math.min(min, item.rentPerDay),
        items[0]?.rentPerDay ?? 0,
      ),
    }
  },
)

export const rentalCatalogOptions = queryOptions({
  queryKey: queryKeys.rental.catalog(),
  queryFn: () => getRentalCatalog(),
})

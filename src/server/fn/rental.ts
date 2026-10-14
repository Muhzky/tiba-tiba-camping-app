import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { and, eq, gt, inArray, lt } from 'drizzle-orm'
import { db } from '#/server/db'
import { orderItems, orders, productVariants, products, rentalUnits } from '#/server/db/schema'
import { rentalDays } from '#/lib/order-totals'

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
      rentDeposit: products.rentDeposit,
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
    occupied = new Set(occupiedRows.map((r) => r.unit).filter((v): v is string => Boolean(v)))
  }

  const freeUnits = unitRows.filter(
    (u) => u.status !== 'maintenance' && !occupied.has(u.id),
  ).length

  return {
    available: freeUnits > 0,
    days,
    rentPerDay: product.rentPricePerDay,
    rentTotal: product.rentPricePerDay * days,
    deposit: product.rentDeposit,
    freeUnits,
  }
}

export const checkRentalAvailability = createServerFn({ method: 'POST' })
  .validator((input: z.infer<typeof rentalAvailabilitySchema>) => rentalAvailabilitySchema.parse(input))
  .handler(({ data }) => getRentalAvailability(data))

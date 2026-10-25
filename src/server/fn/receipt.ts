import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#/server/db'
import {
  orderItems,
  orderStatusLogs,
  orders,
  payments,
  rentalUnits,
  users,
} from '#/server/db/schema'
import { queryKeys } from '#/lib/query-keys'
import { getSessionUser } from '#/server/fn/auth'
import { getSiteSettings } from '#/server/fn/settings'
import type { SiteSettings } from '#/server/fn/settings'

export type ReceiptOrder = Omit<typeof orders.$inferSelect, 'shippingAddress'> & {
  shippingAddress: Record<string, string> | null
}

export type ReceiptData = {
  order: ReceiptOrder
  customer: string | null
  customerEmail: string | null
  cashier: string | null
  settings: SiteSettings
  items: Array<{
    id: string
    name: string
    unitPrice: number
    qty: number
    rentStart: Date | null
    rentEnd: Date | null
    rentDays: number | null
    serial: string | null
  }>
  payments: Array<{
    id: string
    provider: string
    grossAmount: number
    status: string
    createdAt: Date
  }>
}

export const receiptSchema = z.object({
  code: z.string().trim().min(3).max(40),
})

export const getReceipt = createServerFn({ method: 'GET' })
  .validator((input: z.infer<typeof receiptSchema>) => receiptSchema.parse(input))
  .handler(async ({ data }): Promise<ReceiptData> => {
    const user = await getSessionUser()
    if (!user) throw new Error('UNAUTHORIZED')

    const [row] = await db
      .select({
        order: orders,
        customer: users.name,
        customerEmail: users.email,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(eq(orders.code, data.code))
      .limit(1)

    if (!row) throw new Error('ORDER_TIDAK_DITEMUKAN')
    const isAdmin = user.role === 'admin' || user.role === 'owner'
    if (!isAdmin && row.order.userId !== user.id) throw new Error('AKSES_DITOLAK')

    const items = await db
      .select({
        id: orderItems.id,
        name: orderItems.nameSnapshot,
        unitPrice: orderItems.unitPrice,
        qty: orderItems.qty,
        rentStart: orderItems.rentStart,
        rentEnd: orderItems.rentEnd,
        rentDays: orderItems.rentDays,
        serial: rentalUnits.serialCode,
      })
      .from(orderItems)
      .leftJoin(rentalUnits, eq(rentalUnits.id, orderItems.rentalUnitId))
      .where(eq(orderItems.orderId, row.order.id))

    const paymentRows = await db
      .select({
        id: payments.id,
        provider: payments.provider,
        grossAmount: payments.grossAmount,
        status: payments.status,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(eq(payments.orderId, row.order.id))
      .orderBy(asc(payments.createdAt))

    let cashier: string | null = null
    if (row.order.channel === 'pos') {
      const [log] = await db
        .select({ name: users.name })
        .from(orderStatusLogs)
        .leftJoin(users, eq(users.id, orderStatusLogs.actorId))
        .where(
          and(eq(orderStatusLogs.orderId, row.order.id), eq(orderStatusLogs.toStatus, 'paid')),
        )
        .orderBy(asc(orderStatusLogs.createdAt))
        .limit(1)
      cashier = log?.name ?? null
    }

    return {
      order: {
        ...row.order,
        shippingAddress: (row.order.shippingAddress ?? null) as Record<string, string> | null,
      },
      customer: row.customer,
      customerEmail: row.customerEmail,
      cashier,
      settings: await getSiteSettings(),
      items,
      payments: paymentRows,
    }
  })

export const receiptOptions = (code: string) =>
  queryOptions({
    queryKey: queryKeys.orders.receipt(code),
    queryFn: () => getReceipt({ data: { code } }),
  })

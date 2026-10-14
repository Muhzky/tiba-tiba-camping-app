import { createServerFn } from '@tanstack/react-start'
import { desc, eq, sql } from 'drizzle-orm'
import { queryOptions } from '@tanstack/react-query'
import { db } from '#/server/db'
import { orderItems, orders } from '#/server/db/schema'
import { queryKeys } from '#/lib/query-keys'
import { getSessionUser } from '#/server/fn/auth'

export async function requireUser() {
  const user = await getSessionUser()
  if (!user) throw new Error('UNAUTHORIZED')
  return user
}

export type MyOrder = {
  id: string
  code: string
  type: string
  status: string
  paymentStatus: string
  grandTotal: number
  itemCount: number
  createdAt: Date
  rentStart: Date | null
  rentEnd: Date | null
}

export const getMyOrders = createServerFn({ method: 'GET' }).handler(
  async (): Promise<MyOrder[]> => {
    const user = await requireUser()
    const rows = await db
      .select({
        id: orders.id,
        code: orders.code,
        type: orders.type,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        grandTotal: orders.grandTotal,
        createdAt: orders.createdAt,
        itemCount: sql<number>`coalesce(sum(${orderItems.qty}), 0)`,
        rentStart: sql<Date | null>`min(${orderItems.rentStart})`,
        rentEnd: sql<Date | null>`max(${orderItems.rentEnd})`,
      })
      .from(orders)
      .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(eq(orders.userId, user.id))
      .groupBy(orders.id)
      .orderBy(desc(orders.createdAt))
    return rows.map((row) => ({
      ...row,
      itemCount: Number(row.itemCount),
      rentStart: row.rentStart ? new Date(row.rentStart) : null,
      rentEnd: row.rentEnd ? new Date(row.rentEnd) : null,
    }))
  },
)

export const myOrdersOptions = queryOptions({
  queryKey: queryKeys.orders.my(),
  queryFn: () => getMyOrders(),
})

import { eq, sql } from 'drizzle-orm'
import type { db as database } from '#/server/db'
import { orderItems, productVariants } from '#/server/db/schema'

export type Tx = Parameters<Parameters<typeof database.transaction>[0]>[0]

/**
 * Kembalikan stok produk dari order beli.
 * Dipakai saat pesanan batal/kedaluwarsa/refund, dan oleh aksi admin.
 */
export async function restockBuyOrder(tx: Tx, orderId: string) {
  const items = await tx
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
  for (const item of items) {
    await tx
      .update(productVariants)
      .set({ stock: sql`stock + ${item.qty}` })
      .where(eq(productVariants.id, item.variantId))
  }
}

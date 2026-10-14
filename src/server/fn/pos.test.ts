import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '#/server/db'
import {
  categories,
  orders,
  payments,
  products,
  productVariants,
  users,
} from '#/server/db/schema'
import { createPosOrderCore } from '#/server/fn/admin'

let actorId: string
let categoryId: string
let productId: string
let variantId: string
const createdOrders: string[] = []

describe('POS kasir', () => {
  beforeAll(async () => {
    const [actor] = await db
      .insert(users)
      .values({
        name: 'Kasir Uji',
        email: `pos-test-${Date.now()}@tibatibacamping.test`,
        emailVerified: true,
        role: 'admin',
      })
      .returning({ id: users.id })
    actorId = actor.id

    const [cat] = await db
      .insert(categories)
      .values({ name: `POS Test ${Date.now()}`, slug: `pos-test-${Date.now()}` })
      .returning({ id: categories.id })
    categoryId = cat.id

    const [product] = await db
      .insert(products)
      .values({
        categoryId,
        name: 'Tenda Uji POS',
        slug: `tenda-uji-pos-${Date.now()}`,
        salePrice: 100_000,
        discountPercent: 10,
        isSellable: true,
        isRentable: false,
      })
      .returning({ id: products.id })
    productId = product.id

    const [variant] = await db
      .insert(productVariants)
      .values({ productId, sku: `UPS-${Date.now()}`, stock: 3 })
      .returning({ id: productVariants.id })
    variantId = variant.id
  })

  afterAll(async () => {
    if (createdOrders.length) await db.delete(orders).where(inArray(orders.id, createdOrders))
    if (variantId) await db.delete(productVariants).where(eq(productVariants.id, variantId))
    if (productId) await db.delete(products).where(eq(products.id, productId))
    if (categoryId) await db.delete(categories).where(eq(categories.id, categoryId))
    if (actorId) await db.delete(users).where(eq(users.id, actorId))
  })

  it('order beli: paid, stok berkurang, pembayaran tercatat', async () => {
    const { orderId } = await createPosOrderCore(
      { mode: 'buy', paymentMethod: 'cash', items: [{ variantId, qty: 2 }] },
      { id: actorId, name: 'Kasir Uji' },
    )
    createdOrders.push(orderId)

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
    expect(order.channel).toBe('pos')
    expect(order.type).toBe('buy')
    expect(order.status).toBe('paid')
    expect(order.subtotal).toBe(180_000)
    expect(order.grandTotal).toBe(180_000)
    expect(order.paidAt).not.toBeNull()

    const [variant] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, variantId))
    expect(variant.stock).toBe(1)

    const pays = await db.select().from(payments).where(eq(payments.orderId, orderId))
    expect(pays).toHaveLength(1)
    expect(pays[0].status).toBe('paid')
  })

  it('stok kurang ditolak', async () => {
    await expect(
      createPosOrderCore(
        { mode: 'buy', paymentMethod: 'qris', items: [{ variantId, qty: 5 }] },
        { id: actorId, name: 'Kasir Uji' },
      ),
    ).rejects.toThrow('STOK_KURANG')
  })
})

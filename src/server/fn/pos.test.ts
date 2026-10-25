import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '#/server/db'
import {
  categories,
  orderItems,
  orders,
  payments,
  products,
  productVariants,
  rentalUnits,
  users,
} from '#/server/db/schema'
import { createPosOrderCore, returnRentalCore } from '#/server/fn/admin'

let actorId: string
let categoryId: string
let productId: string
let variantId: string
let rentProductId: string
let rentVariantId: string
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

    const [rentProduct] = await db
      .insert(products)
      .values({
        categoryId,
        name: 'Tenda Sewa POS',
        slug: `tenda-sewa-pos-${Date.now()}`,
        salePrice: 500_000,
        rentPricePerDay: 100_000,
        isSellable: false,
        isRentable: true,
      })
      .returning({ id: products.id })
    rentProductId = rentProduct.id

    const [rentVariant] = await db
      .insert(productVariants)
      .values({ productId: rentProductId, sku: `UPS-R-${Date.now()}`, stock: 0 })
      .returning({ id: productVariants.id })
    rentVariantId = rentVariant.id

    await db.insert(rentalUnits).values([
      { variantId: rentVariantId, serialCode: `UPS-R-${Date.now()}-1` },
      { variantId: rentVariantId, serialCode: `UPS-R-${Date.now()}-2` },
    ])
  })

  afterAll(async () => {
    if (createdOrders.length) await db.delete(orders).where(inArray(orders.id, createdOrders))
    if (rentVariantId) await db.delete(rentalUnits).where(eq(rentalUnits.variantId, rentVariantId))
    if (rentVariantId) await db.delete(productVariants).where(eq(productVariants.id, rentVariantId))
    if (rentProductId) await db.delete(products).where(eq(products.id, rentProductId))
    if (variantId) await db.delete(productVariants).where(eq(productVariants.id, variantId))
    if (productId) await db.delete(products).where(eq(products.id, productId))
    if (categoryId) await db.delete(categories).where(eq(categories.id, categoryId))
    if (actorId) await db.delete(users).where(eq(users.id, actorId))
  })

  it('order beli: paid, stok berkurang, pembayaran tercatat', async () => {
    const { orderId, code } = await createPosOrderCore(
      {
        mode: 'buy',
        paymentMethod: 'cash',
        customerName: 'Rina Walk-in',
        items: [{ variantId, qty: 2 }],
      },
      { id: actorId, name: 'Kasir Uji' },
    )
    createdOrders.push(orderId)

    expect(code).toMatch(/^TTC-/)
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
    expect(order.channel).toBe('pos')
    expect(order.type).toBe('buy')
    expect(order.status).toBe('paid')
    expect(order.customerName).toBe('Rina Walk-in')
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

  it('order sewa POS: deposit 50% dari total sewa dan tenggat tersimpan', async () => {
    const start = new Date('2026-11-01T00:00:00Z')
    const end = new Date('2026-11-04T00:00:00Z')

    const { orderId, code } = await createPosOrderCore(
      {
        mode: 'rent',
        paymentMethod: 'cash',
        customerName: 'Sewa Walk-in',
        rentStart: start.toISOString(),
        rentEnd: end.toISOString(),
        items: [{ variantId: rentVariantId, qty: 1 }],
      },
      { id: actorId, name: 'Kasir Uji' },
    )
    createdOrders.push(orderId)

    expect(code).toMatch(/^TTC-/)
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
    expect(order.type).toBe('rent')
    expect(order.status).toBe('rented')
    expect(order.subtotal).toBe(300_000)
    expect(order.depositTotal).toBe(150_000)
    expect(order.grandTotal).toBe(450_000)

    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
    expect(items).toHaveLength(1)
    expect(items[0].rentEnd?.toISOString()).toBe(end.toISOString())
    expect(items[0].rentalUnitId).toBeTruthy()
  })

  it('pengembalian sewa langsung menyelesaikan transaksi', async () => {
    const start = new Date('2026-12-01T00:00:00Z')
    const end = new Date('2026-12-03T00:00:00Z')
    const { orderId } = await createPosOrderCore(
      {
        mode: 'rent',
        paymentMethod: 'cash',
        rentStart: start.toISOString(),
        rentEnd: end.toISOString(),
        items: [{ variantId: rentVariantId, qty: 1 }],
      },
      { id: actorId, name: 'Kasir Uji' },
    )
    createdOrders.push(orderId)

    const [item] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
    expect(item.rentalUnitId).toBeTruthy()

    const result = await returnRentalCore(
      {
        orderId,
        lateDays: 1,
        lateFee: 100_000,
        damageFee: 25_000,
        depositRefund: 75_000,
        conditionNote: 'Tenda bersih',
      },
      { id: actorId },
    )
    expect(result.depositRefunded).toBe(75_000)

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
    expect(order.status).toBe('completed')
    expect(order.returnedAt).not.toBeNull()
    expect(order.lateDays).toBe(1)
    expect(order.lateFee).toBe(100_000)
    expect(order.damageFee).toBe(25_000)
    expect(order.depositRefunded).toBe(75_000)

    const [unit] = await db
      .select()
      .from(rentalUnits)
      .where(eq(rentalUnits.id, item.rentalUnitId as string))
    expect(unit.status).toBe('available')
  })
})

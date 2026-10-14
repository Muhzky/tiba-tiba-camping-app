import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '#/server/db'
import {
  categories,
  orderItems,
  orders,
  products,
  productVariants,
  rentalUnits,
  users,
} from '#/server/db/schema'
import { getRentalAvailability } from '#/server/fn/rental'
import { pickRentUnits } from '#/server/fn/checkout'

const DAY = 86_400_000

let userId: string
let categoryId: string
let variantId: string
let productId: string
let unit1: string
let unit2: string

async function callAvailability(start: Date, end: Date) {
  return getRentalAvailability({
    productId,
    start: start.toISOString(),
    end: end.toISOString(),
  })
}

async function createFixtures() {
  const [user] = await db
    .insert(users)
    .values({
      name: 'Rental Tester',
      email: `rental-test-${Date.now()}@tibatibacamping.test`,
      emailVerified: true,
      role: 'customer',
    })
    .returning({ id: users.id })
  userId = user.id

  const [cat] = await db
    .insert(categories)
    .values({ name: `Sewa Test ${Date.now()}`, slug: `sewa-test-${Date.now()}` })
    .returning({ id: categories.id })
  categoryId = cat.id

  const [product] = await db
    .insert(products)
    .values({
      categoryId: cat.id,
      name: 'Tenda Uji Sewa',
      slug: `tenda-uji-sewa-${Date.now()}`,
      salePrice: 500_000,
      rentPricePerDay: 75_000,
      rentDeposit: 100_000,
      isRentable: true,
      isSellable: false,
    })
    .returning({ id: products.id })
  productId = product.id

  const [variant] = await db
    .insert(productVariants)
    .values({ productId, sku: `UTS-${Date.now()}`, stock: 0 })
    .returning({ id: productVariants.id })
  variantId = variant.id

  const units = await db
    .insert(rentalUnits)
    .values([
      { variantId, serialCode: `UTS-${Date.now()}-1` },
      { variantId, serialCode: `UTS-${Date.now()}-2` },
    ])
    .returning({ id: rentalUnits.id })
  unit1 = units[0].id
  unit2 = units[1].id
}

async function occupyUnit(unitId: string, start: Date, end: Date, code: string) {
  const [order] = await db
    .insert(orders)
    .values({
      code,
      userId,
      type: 'rent',
      status: 'rented',
      subtotal: 0,
      grandTotal: 0,
    })
    .returning({ id: orders.id })
  await db.insert(orderItems).values({
    orderId: order.id,
    variantId,
    rentalUnitId: unitId,
    nameSnapshot: 'Tenda Uji Sewa',
    unitPrice: 75_000,
    qty: 1,
    rentStart: start,
    rentEnd: end,
    rentDays: Math.ceil((end.getTime() - start.getTime()) / DAY),
  })
  return order.id
}

async function cleanup() {
  await db.delete(orders).where(eq(orders.userId, userId))
  if (variantId) await db.delete(productVariants).where(eq(productVariants.id, variantId))
  if (productId) await db.delete(products).where(eq(products.id, productId))
  if (categoryId) await db.delete(categories).where(eq(categories.id, categoryId))
  if (userId) await db.delete(users).where(eq(users.id, userId))
}

describe('ketersediaan sewa', () => {
  beforeAll(async () => {
    await createFixtures()
  })

  afterAll(async () => {
    await cleanup()
  })

  it('semua unit bebas saat belum ada order', async () => {
    const result = await callAvailability(new Date(Date.now() + 5 * DAY), new Date(Date.now() + 7 * DAY))
    expect(result).not.toBeNull()
    expect(result?.available).toBe(true)
    expect(result?.freeUnits).toBe(2)
    expect(result?.days).toBe(2)
    expect(result?.rentTotal).toBe(75_000 * 2)
    expect(result?.deposit).toBe(100_000)
  })

  it('unit yang dibooking tidak dihitung bebas pada periode yang tumpang tindih', async () => {
    const start = new Date(Date.now() + 10 * DAY)
    const end = new Date(Date.now() + 13 * DAY)
    const created: string[] = []
    created.push(await occupyUnit(unit1, start, end, `TST-${Date.now()}-A`))

    const overlap = await callAvailability(new Date(Date.now() + 11 * DAY), new Date(Date.now() + 12 * DAY))
    expect(overlap?.freeUnits).toBe(1)
    expect(overlap?.available).toBe(true)

    created.push(await occupyUnit(unit2, start, end, `TST-${Date.now()}-B`))
    const full = await callAvailability(new Date(Date.now() + 11 * DAY), new Date(Date.now() + 12 * DAY))
    expect(full?.freeUnits).toBe(0)
    expect(full?.available).toBe(false)

    const outside = await callAvailability(new Date(Date.now() + 20 * DAY), new Date(Date.now() + 21 * DAY))
    expect(outside?.freeUnits).toBe(2)

    for (const id of created) {
      await db.delete(orders).where(eq(orders.id, id))
    }
  })

  it('pickRentUnits: pilih unit bebas, tolak kuarga kurang, abaikan periode lain', async () => {
    const start = new Date(Date.now() + 30 * DAY)
    const end = new Date(Date.now() + 33 * DAY)
    const occupiedId = await occupyUnit(unit1, start, end, `TST-${Date.now()}-C`)

    const picked = await db.transaction((tx) =>
      pickRentUnits(tx, { variantId, qty: 1, start, end }),
    )
    expect(picked).toEqual([unit2])

    await expect(
      db.transaction((tx) => pickRentUnits(tx, { variantId, qty: 2, start, end })),
    ).rejects.toThrow('KUOTA_KURANG')

    const other = await db.transaction((tx) =>
      pickRentUnits(tx, {
        variantId,
        qty: 2,
        start: new Date(Date.now() + 40 * DAY),
        end: new Date(Date.now() + 42 * DAY),
      }),
    )
    expect([...other].sort()).toEqual([unit1, unit2].sort())

    await db.delete(orders).where(eq(orders.id, occupiedId))
  })

  it('produk non-sewa / tanpa harga sewa mengembalikan null', async () => {
    const [plain] = await db
      .insert(products)
      .values({
        categoryId: (await db.select({ id: categories.id }).from(categories).limit(1))[0].id,
        name: 'Produk Biasa',
        slug: `produk-biasa-${Date.now()}`,
        salePrice: 100_000,
        isRentable: false,
      })
      .returning({ id: products.id })
    const result = await getRentalAvailability({
      productId: plain.id,
      start: new Date(Date.now() + DAY).toISOString(),
      end: new Date(Date.now() + 2 * DAY).toISOString(),
    })
    expect(result).toBeNull()
    await db.delete(products).where(eq(products.id, plain.id))
  })
})

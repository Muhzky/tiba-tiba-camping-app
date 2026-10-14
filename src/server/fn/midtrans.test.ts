import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import crypto from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '#/server/db'
import {
  categories,
  orders,
  orderItems,
  payments,
  products,
  productVariants,
} from '#/server/db/schema'
import {
  processMidtransNotification,
  verifyMidtransSignature,
} from '#/server/fn/midtrans'
import { env } from '#/lib/env'

let categoryId: string
let productId: string
let variantId: string
let orderId: string

const GROSS = '100000'

function sign(orderCode: string, statusCode = '200'): string {
  return crypto
    .createHash('sha512')
    .update(`${orderCode}${statusCode}${GROSS}${env.MIDTRANS_SERVER_KEY}`)
    .digest('hex')
}

function notify(orderCode: string, status: string, signature?: string) {
  return {
    order_id: orderCode,
    status_code: '200',
    gross_amount: GROSS,
    signature_key: signature ?? sign(orderCode),
    transaction_status: status,
  }
}

describe('webhook Midtrans', () => {
  let orderCode: string

  beforeAll(async () => {
    const [cat] = await db
      .insert(categories)
      .values({ name: `Webhook Test ${Date.now()}`, slug: `webhook-test-${Date.now()}` })
      .returning({ id: categories.id })
    categoryId = cat.id

    const [product] = await db
      .insert(products)
      .values({
        categoryId,
        name: 'Tenda Uji Webhook',
        slug: `tenda-uji-webhook-${Date.now()}`,
        salePrice: 50_000,
        isSellable: true,
      })
      .returning({ id: products.id })
    productId = product.id

    // stok sudah dikurangi saat checkout (reservasi) → 5 - 2 = 3
    const [variant] = await db
      .insert(productVariants)
      .values({ productId, sku: `UWS-${Date.now()}`, stock: 3 })
      .returning({ id: productVariants.id })
    variantId = variant.id

    orderCode = `TTC-TEST-${Date.now()}`
    const [order] = await db
      .insert(orders)
      .values({
        code: orderCode,
        type: 'buy',
        status: 'pending_payment',
        subtotal: 100_000,
        grandTotal: 100_000,
      })
      .returning({ id: orders.id })
    orderId = order.id

    await db.insert(orderItems).values({
      orderId,
      variantId,
      nameSnapshot: 'Tenda Uji Webhook',
      unitPrice: 50_000,
      qty: 2,
    })
    await db.insert(payments).values({ orderId, grossAmount: 100_000 })
  })

  afterAll(async () => {
    if (orderId) await db.delete(orders).where(eq(orders.id, orderId))
    if (variantId) await db.delete(productVariants).where(eq(productVariants.id, variantId))
    if (productId) await db.delete(products).where(eq(products.id, productId))
    if (categoryId) await db.delete(categories).where(eq(categories.id, categoryId))
  })

  it('field wajib kurang → 400', async () => {
    const res = await processMidtransNotification({ transaction_status: 'settlement' })
    expect(res.status).toBe(400)
  })

  it('signature salah → 403', async () => {
    const res = await processMidtransNotification(
      notify(orderCode, 'settlement', 'f'.repeat(128)),
    )
    expect(res.status).toBe(403)
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
    expect(order.status).toBe('pending_payment')
  })

  it('verifyMidtransSignature benar/salah', () => {
    expect(verifyMidtransSignature(orderCode, '200', GROSS, sign(orderCode))).toBe(true)
    expect(verifyMidtransSignature(orderCode, '200', GROSS, 'abc')).toBe(false)
  })

  it('settlement → processing, pembayaran paid, paidAt terisi', async () => {
    const res = await processMidtransNotification(notify(orderCode, 'settlement'))
    expect(res).toEqual({ status: 200, message: 'ok' })
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
    expect(order.status).toBe('processing')
    expect(order.paidAt).not.toBeNull()
    const [pay] = await db.select().from(payments).where(eq(payments.orderId, orderId))
    expect(pay.status).toBe('paid')
    expect(pay.signatureValid).toBe(true)
    expect(pay.rawNotification).toMatchObject({ transaction_status: 'settlement' })
  })

  it('notifikasi berulang idempoten', async () => {
    const res = await processMidtransNotification(notify(orderCode, 'settlement'))
    expect(res.status).toBe(200)
    expect(res.message).toContain('already')
    const [pay] = await db.select().from(payments).where(eq(payments.orderId, orderId))
    expect(pay.status).toBe('paid')
  })

  it('cancel → order cancelled, stok dipulihkan', async () => {
    const res = await processMidtransNotification(notify(orderCode, 'cancel'))
    expect(res).toEqual({ status: 200, message: 'ok' })
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
    expect(order.status).toBe('cancelled')
    const [variant] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, variantId))
    expect(variant.stock).toBe(5)
    const [pay] = await db.select().from(payments).where(eq(payments.orderId, orderId))
    expect(pay.status).toBe('failed')
  })

  it('state final tidak tertimpa (settlement setelah cancel)', async () => {
    const res = await processMidtransNotification(notify(orderCode, 'settlement'))
    expect(res.status).toBe(200)
    expect(res.message).toBe('already cancelled')
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
    expect(order.status).toBe('cancelled')
  })
})

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
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
  baseOrderCode,
  processMidtransNotification,
  syncMidtransPayment,
  verifyMidtransSignature,
} from '#/server/fn/midtrans'
import { env } from '#/lib/env'

let categoryId: string
let productId: string
let variantId: string
let orderId: string
let rentOrderId: string

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
    if (rentOrderId) await db.delete(orders).where(eq(orders.id, rentOrderId))
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

  it('baseOrderCode melepas sufiks percobaan bayar ulang', () => {
    expect(baseOrderCode('TTC-260101-AB12-RLZ9')).toBe('TTC-260101-AB12')
    expect(baseOrderCode('TTC-260101-AB12')).toBe('TTC-260101-AB12')
  })

  it('settlement → processing, pembayaran paid, paidAt terisi', async () => {
    const res = await processMidtransNotification(notify(orderCode, 'settlement'))
    expect(res).toEqual({ status: 200, message: 'ok' })
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
    expect(order.status).toBe('processing')
    expect(order.paymentStatus).toBe('paid')
    expect(order.paidAt).not.toBeNull()
    const [pay] = await db.select().from(payments).where(eq(payments.orderId, orderId))
    expect(pay.status).toBe('paid')
    expect(pay.signatureValid).toBe(true)
    expect(pay.rawNotification).toMatchObject({ transaction_status: 'settlement' })
  })

  it('order_id bayar ulang bersufiks -R tetap terpetakan ke order', async () => {
    const code = `TTC-RETRY-${Date.now()}`
    const midtransOrderId = `${code}-RABC123`
    const [order] = await db
      .insert(orders)
      .values({
        code,
        type: 'buy',
        status: 'pending_payment',
        subtotal: 100_000,
        grandTotal: 100_000,
        midtransOrderId,
      })
      .returning({ id: orders.id })
    await db.insert(payments).values({ orderId: order.id, grossAmount: 100_000 })

    try {
      const res = await processMidtransNotification({
        order_id: midtransOrderId,
        status_code: '200',
        gross_amount: GROSS,
        signature_key: sign(midtransOrderId),
        transaction_status: 'settlement',
      })
      expect(res).toEqual({ status: 200, message: 'ok' })

      const [updated] = await db.select().from(orders).where(eq(orders.id, order.id))
      expect(updated.status).toBe('processing')
      expect(updated.paymentStatus).toBe('paid')
      const [pay] = await db.select().from(payments).where(eq(payments.orderId, order.id))
      expect(pay.status).toBe('paid')
    } finally {
      await db.delete(orders).where(eq(orders.id, order.id))
    }
  })

  it('memperbaiki order pending yang pembayarannya sudah paid', async () => {
    await db
      .update(orders)
      .set({ status: 'pending_payment', paymentStatus: 'pending', paidAt: null })
      .where(eq(orders.id, orderId))

    const res = await processMidtransNotification(notify(orderCode, 'settlement'))
    expect(res).toEqual({ status: 200, message: 'ok' })

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
    expect(order.status).toBe('processing')
    expect(order.paymentStatus).toBe('paid')
  })

  it('notifikasi percobaan lama tidak menimpa percobaan bayar terbaru', async () => {
    const code = `TTC-STALE-${Date.now()}`
    const currentId = `${code}-RNEW1`
    const oldId = `${code}-ROLD1`
    const [order] = await db
      .insert(orders)
      .values({
        code,
        type: 'buy',
        status: 'pending_payment',
        subtotal: 100_000,
        grandTotal: 100_000,
        midtransOrderId: currentId,
      })
      .returning({ id: orders.id })
    await db.insert(payments).values({ orderId: order.id, grossAmount: 100_000 })

    try {
      const stale = await processMidtransNotification({
        order_id: oldId,
        status_code: '200',
        gross_amount: GROSS,
        signature_key: sign(oldId),
        transaction_status: 'expire',
      })
      expect(stale).toEqual({ status: 200, message: 'stale transaction' })
      const [stillPending] = await db.select().from(orders).where(eq(orders.id, order.id))
      expect(stillPending.status).toBe('pending_payment')
      expect(stillPending.midtransOrderId).toBe(currentId)

      // Uang dari percobaan lama tetap harus diakui.
      const paid = await processMidtransNotification({
        order_id: oldId,
        status_code: '200',
        gross_amount: GROSS,
        signature_key: sign(oldId),
        transaction_status: 'settlement',
      })
      expect(paid).toEqual({ status: 200, message: 'ok' })
      const [updated] = await db.select().from(orders).where(eq(orders.id, order.id))
      expect(updated.status).toBe('processing')
      expect(updated.paymentStatus).toBe('paid')
    } finally {
      await db.delete(orders).where(eq(orders.id, order.id))
    }
  })

  it('sync onlyPaid mengabaikan transaksi lama yang kedaluwarsa', async () => {
    const code = `TTC-ONLYPAID-${Date.now()}`
    const [order] = await db
      .insert(orders)
      .values({
        code,
        type: 'buy',
        status: 'pending_payment',
        subtotal: 100_000,
        grandTotal: 100_000,
        midtransOrderId: code,
      })
      .returning()
    await db.insert(payments).values({ orderId: order.id, grossAmount: 100_000 })

    const fetchMock = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            order_id: code,
            status_code: '200',
            gross_amount: '100000.00',
            transaction_status: 'expire',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)

    try {
      const synced = await syncMidtransPayment(order, { onlyPaid: true })
      expect(synced.resolved).toBe(false)
      expect(synced.paid).toBe(false)
      const [pending] = await db.select().from(orders).where(eq(orders.id, order.id))
      expect(pending.status).toBe('pending_payment')
      expect(pending.paymentStatus).toBe('pending')
    } finally {
      vi.unstubAllGlobals()
      await db.delete(orders).where(eq(orders.id, order.id))
    }
  })

  it('syncMidtransPayment menarik status langsung dari API Midtrans', async () => {
    const code = `TTC-SYNC-${Date.now()}`
    const [order] = await db
      .insert(orders)
      .values({
        code,
        type: 'buy',
        status: 'pending_payment',
        subtotal: 100_000,
        grandTotal: 100_000,
        midtransOrderId: code,
      })
      .returning()
    await db.insert(payments).values({ orderId: order.id, grossAmount: 100_000 })

    const fetchMock = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            order_id: code,
            status_code: '200',
            gross_amount: '100000.00',
            transaction_status: 'settlement',
            fraud_status: 'accept',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)

    try {
      const synced = await syncMidtransPayment(order)
      expect(synced).toEqual({
        resolved: true,
        paid: true,
        orderStatus: 'processing',
        paymentStatus: 'paid',
      })
      expect(fetchMock).toHaveBeenCalledOnce()
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain(`/v2/${code}/status`)
    } finally {
      vi.unstubAllGlobals()
      await db.delete(orders).where(eq(orders.id, order.id))
    }
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

  it('settlement order sewa → status rented, siap dikembalikan', async () => {
    const code = `TTC-RENT-${Date.now()}`
    const [order] = await db
      .insert(orders)
      .values({
        code,
        type: 'rent',
        status: 'pending_payment',
        subtotal: 100_000,
        grandTotal: 100_000,
      })
      .returning({ id: orders.id })
    rentOrderId = order.id
    await db.insert(payments).values({ orderId: order.id, grossAmount: 100_000 })

    const res = await processMidtransNotification(notify(code, 'settlement'))
    expect(res).toEqual({ status: 200, message: 'ok' })
    const [updated] = await db.select().from(orders).where(eq(orders.id, order.id))
    expect(updated.status).toBe('rented')
    expect(updated.paidAt).not.toBeNull()
  })
})

import crypto from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '#/server/db'
import { orderStatusLogs, orders, payments } from '#/server/db/schema'
import { restockBuyOrder } from '#/server/fn/checkout'
import { env } from '#/lib/env'

export type MidtransNotification = {
  order_id?: string
  status_code?: string
  gross_amount?: string
  signature_key?: string
  transaction_status: string
  fraud_status?: string
  payment_type?: string
  transaction_time?: string
  [key: string]: unknown
}

export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureKey: string,
): boolean {
  const expected = crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${env.MIDTRANS_SERVER_KEY}`)
    .digest('hex')
  return expected === signatureKey
}

const RESTOCK_FROM = new Set(['cancel', 'deny', 'expire'])

export type WebhookResult = { status: number; message: string }

export async function processMidtransNotification(
  body: MidtransNotification,
): Promise<WebhookResult> {
  const orderId = body.order_id
  const statusCode = body.status_code
  const grossAmount = body.gross_amount
  const signatureKey = body.signature_key
  if (!orderId || !statusCode || !grossAmount || !signatureKey) {
    return { status: 400, message: 'missing fields' }
  }
  if (!verifyMidtransSignature(orderId, statusCode, grossAmount, signatureKey)) {
    return { status: 403, message: 'invalid signature' }
  }

  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(orders)
      .where(eq(orders.code, orderId))
      .limit(1)
    const order = rows.at(0)
    if (!order) return { status: 404, message: 'order not found' }

    const payRows = await tx
      .select({ status: payments.status })
      .from(payments)
      .where(eq(payments.orderId, order.id))
      .limit(1)
    const pay = payRows.at(0)

    await tx
      .update(payments)
      .set({ rawNotification: body, signatureValid: true })
      .where(eq(payments.orderId, order.id))

    const status = body.transaction_status

    // Idempoten: state final tidak boleh tertimpa oleh update lama
    const finalStates = ['completed', 'cancelled', 'expired', 'refunded']
    if (finalStates.includes(order.status)) {
      return { status: 200, message: `already ${order.status}` }
    }

    let nextOrderStatus: typeof order.status | null = null
    let nextPayment: 'paid' | 'failed' | 'refunded' | null = null

    if (status === 'settlement' || status === 'capture') {
      if (body.fraud_status === 'deny') {
        nextOrderStatus = 'cancelled'
        nextPayment = 'failed'
      } else {
        nextOrderStatus = order.type === 'preorder' ? 'awaiting_stock' : 'processing'
        nextPayment = 'paid'
      }
    } else if (status === 'deny' || status === 'cancel') {
      nextOrderStatus = 'cancelled'
      nextPayment = 'failed'
    } else if (status === 'expire') {
      nextOrderStatus = 'expired'
      nextPayment = 'failed'
    } else if (status === 'refund' || status === 'partial_refund') {
      nextOrderStatus = 'refunded'
      nextPayment = 'refunded'
    }
    // 'pending' → biarkan seperti adanya

    if (nextPayment && pay && pay.status === nextPayment) {
      return { status: 200, message: `payment already ${pay.status}` }
    }
    if (nextPayment && !pay && nextOrderStatus === order.status) {
      return { status: 200, message: `order already ${order.status}` }
    }

    if (nextPayment) {
      await tx
        .update(payments)
        .set({ status: nextPayment })
        .where(eq(payments.orderId, order.id))
    }

    if (nextOrderStatus) {
      await tx
        .update(orders)
        .set({
          status: nextOrderStatus,
          ...(nextPayment === 'paid' ? { paidAt: new Date() } : {}),
        })
        .where(eq(orders.id, order.id))
      await tx.insert(orderStatusLogs).values({
        orderId: order.id,
        fromStatus: order.status,
        toStatus: nextOrderStatus,
        note: `Midtrans: ${status}`,
      })

      if (
        order.type === 'buy' &&
        (RESTOCK_FROM.has(status) || nextOrderStatus === 'refunded')
      ) {
        await restockBuyOrder(tx, order.id)
      }
    }

    return { status: 200, message: 'ok' }
  })
}

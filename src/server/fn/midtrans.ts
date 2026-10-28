import crypto from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { createServerFn } from '@tanstack/react-start'
import { db } from '#/server/db'
import { orderStatusLogs, orders, payments } from '#/server/db/schema'
import { restockBuyOrder } from '#/server/fn/inventory'
import type { Tx } from '#/server/fn/inventory'
import { requireUser } from '#/server/fn/order'
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

export function midtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
): string {
  return crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${env.MIDTRANS_SERVER_KEY}`)
    .digest('hex')
}

export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureKey: string,
): boolean {
  return midtransSignature(orderId, statusCode, grossAmount) === signatureKey
}

const RESTOCK_FROM = new Set(['cancel', 'deny', 'expire'])
const FINAL_ORDER_STATES = ['completed', 'cancelled', 'expired', 'refunded']

/**
 * Bayar ulang memakai `order_id` bersufiks `-R…` (lihat `retryMidtransOrderId`).
 * Kembalikan kode order asli agar notifikasi/status API tetap terpetakan.
 */
export function baseOrderCode(midtransOrderId: string): string {
  return midtransOrderId.replace(/-R[A-Z0-9]+$/i, '')
}

async function findOrderByMidtransId(tx: Tx, midtransOrderId: string) {
  const exact = await tx
    .select()
    .from(orders)
    .where(eq(orders.midtransOrderId, midtransOrderId))
    .limit(1)
  if (exact.at(0)) return exact.at(0)

  // Order lama (sebelum midtrans_order_id diisi) memakai kode order sebagai id.
  const byCode = await tx
    .select()
    .from(orders)
    .where(eq(orders.code, baseOrderCode(midtransOrderId)))
    .limit(1)
  return byCode.at(0)
}

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
  if (
    !verifyMidtransSignature(orderId, statusCode, grossAmount, signatureKey)
  ) {
    return { status: 403, message: 'invalid signature' }
  }

  return db.transaction(async (tx) => {
    const order = await findOrderByMidtransId(tx, orderId)
    if (!order) return { status: 404, message: 'order not found' }

    const status = body.transaction_status
    // Peristiwa yang benar-benar memindahkan uang tetap diakui walau berasal dari
    // percobaan lama; sebaliknya expire/cancel dari percobaan lama tidak boleh
    // membatalkan transaksi bayar ulang yang sedang berjalan.
    const movesMoney =
      status === 'settlement' ||
      status === 'refund' ||
      status === 'partial_refund' ||
      (status === 'capture' && body.fraud_status !== 'deny')

    if (
      order.midtransOrderId &&
      order.midtransOrderId !== orderId &&
      !movesMoney
    ) {
      return { status: 200, message: 'stale transaction' }
    }

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

    // Simpan id transaksi Midtrans untuk order lama yang belum punya.
    if (!order.midtransOrderId) {
      await tx
        .update(orders)
        .set({ midtransOrderId: orderId })
        .where(eq(orders.id, order.id))
    }

    // Idempoten: state final tidak boleh tertimpa oleh update lama
    if (FINAL_ORDER_STATES.includes(order.status)) {
      return { status: 200, message: `already ${order.status}` }
    }

    let nextOrderStatus: typeof order.status | null = null
    let nextPayment: 'paid' | 'failed' | 'refunded' | null = null

    if (status === 'settlement' || status === 'capture') {
      if (body.fraud_status === 'deny') {
        nextOrderStatus = 'cancelled'
        nextPayment = 'failed'
      } else if (body.fraud_status === 'challenge') {
        // Menunggu review Midtrans — jangan tandai lunas.
      } else {
        nextOrderStatus =
          order.type === 'preorder'
            ? 'awaiting_stock'
            : order.type === 'rent'
              ? 'rented'
              : 'processing'
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

    if (!nextOrderStatus && !nextPayment) {
      return { status: 200, message: `ignored ${status}` }
    }

    const paymentChanged = nextPayment !== null && pay?.status !== nextPayment
    const orderChanged =
      (nextOrderStatus !== null && order.status !== nextOrderStatus) ||
      (nextPayment !== null && order.paymentStatus !== nextPayment)
    if (!paymentChanged && !orderChanged) {
      return { status: 200, message: `already ${order.status}` }
    }

    if (paymentChanged && nextPayment) {
      await tx
        .update(payments)
        .set({ status: nextPayment })
        .where(eq(payments.orderId, order.id))
    }

    if (orderChanged) {
      await tx
        .update(orders)
        .set({
          ...(nextOrderStatus ? { status: nextOrderStatus } : {}),
          // Sumber kebenaran pembayaran ada di sini — dashboard & struk membacanya.
          ...(nextPayment ? { paymentStatus: nextPayment } : {}),
          ...(nextPayment === 'paid'
            ? { paidAt: order.paidAt ?? new Date() }
            : {}),
        })
        .where(eq(orders.id, order.id))
    }

    if (nextOrderStatus && order.status !== nextOrderStatus) {
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

// ── Sinkronisasi status langsung ke Midtrans ─────────────────────────────────

function midtransApiBase() {
  return env.MIDTRANS_IS_PRODUCTION
    ? 'https://api.midtrans.com'
    : 'https://api.sandbox.midtrans.com'
}

/**
 * Ambil status transaksi dari API Midtrans (server-to-server) dan ubah menjadi
 * bentuk notifikasi. Signature dibuat ulang dari nilai yang dikembalikan Midtrans
 * sehingga bisa diproses lewat jalur webhook yang sama.
 */
export async function fetchMidtransStatus(
  midtransOrderId: string,
): Promise<MidtransNotification | null> {
  const auth = Buffer.from(`${env.MIDTRANS_SERVER_KEY}:`).toString('base64')
  const res = await fetch(
    `${midtransApiBase()}/v2/${encodeURIComponent(midtransOrderId)}/status`,
    {
      headers: { Accept: 'application/json', Authorization: `Basic ${auth}` },
      cache: 'no-store',
    },
  )
  if (res.status === 404) return null
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`MIDTRANS_${res.status}: ${text.slice(0, 200)}`)
  }

  const json = (await res.json()) as Record<string, unknown>
  const transactionStatus =
    typeof json.transaction_status === 'string' ? json.transaction_status : null
  if (!transactionStatus) return null

  const orderId =
    typeof json.order_id === 'string' ? json.order_id : midtransOrderId
  const statusCode = String(json.status_code ?? '200')
  const grossAmount = String(json.gross_amount ?? '')

  return {
    ...json,
    order_id: orderId,
    status_code: statusCode,
    gross_amount: grossAmount,
    signature_key: midtransSignature(orderId, statusCode, grossAmount),
    transaction_status: transactionStatus,
    fraud_status:
      typeof json.fraud_status === 'string' ? json.fraud_status : undefined,
  }
}

export type SyncedPayment = {
  /** false bila transaksi belum/tidak ada di Midtrans atau status gagal diambil. */
  resolved: boolean
  paid: boolean
  orderStatus: string
  paymentStatus: string
}

async function readOrderState(orderId: string) {
  const rows = await db
    .select({ status: orders.status, paymentStatus: orders.paymentStatus })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)
  return rows.at(0) ?? null
}

/**
 * Selaraskan satu order dengan status transaksi di Midtrans.
 * Berguna saat webhook telat/tidak terkirim (mis. pengembangan lokal).
 *
 * `onlyPaid` dipakai sebelum membuat transaksi bayar ulang: hanya hasil lunas
 * yang diterapkan, sehingga transaksi lama yang sudah kedaluwarsa tidak
 * mengubah order menjadi "expired" dan tetap bisa dibayar lagi.
 */
export async function syncMidtransPayment(
  order: {
    id: string
    code: string
    midtransOrderId: string | null
    status: string
    paymentStatus: string
  },
  options: { onlyPaid?: boolean } = {},
): Promise<SyncedPayment> {
  const fallback: SyncedPayment = {
    resolved: false,
    paid: order.paymentStatus === 'paid',
    orderStatus: order.status,
    paymentStatus: order.paymentStatus,
  }

  let notification: MidtransNotification | null
  try {
    notification = await fetchMidtransStatus(
      order.midtransOrderId ?? order.code,
    )
  } catch {
    return fallback
  }
  if (!notification) return fallback

  if (options.onlyPaid) {
    const status = notification.transaction_status
    const settled =
      status === 'settlement' ||
      (status === 'capture' &&
        notification.fraud_status !== 'deny' &&
        notification.fraud_status !== 'challenge')
    if (!settled) return fallback
  }

  const result = await processMidtransNotification(notification)
  const fresh = await readOrderState(order.id)
  return {
    resolved: result.status < 400,
    paid: fresh?.paymentStatus === 'paid',
    orderStatus: fresh?.status ?? order.status,
    paymentStatus: fresh?.paymentStatus ?? order.paymentStatus,
  }
}

export const syncOrderPayment = createServerFn({ method: 'POST' })
  .validator((orderId: string) => orderId)
  .handler(async ({ data }): Promise<SyncedPayment> => {
    const user = await requireUser()
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, data), eq(orders.userId, user.id)))
      .limit(1)
    if (!order) throw new Error('ORDER_TIDAK_DITEMUKAN')
    return syncMidtransPayment(order)
  })

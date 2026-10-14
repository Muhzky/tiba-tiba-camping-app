import { createServerFn } from '@tanstack/react-start'
import crypto from 'node:crypto'
import { and, eq, gt, inArray, lt, sql } from 'drizzle-orm'
import { z } from 'zod'
import { queryOptions } from '@tanstack/react-query'
import { db } from '#/server/db'
import {
  addresses,
  orderItems,
  orderStatusLogs,
  orders,
  payments,
  productVariants,
  rentalUnits,
} from '#/server/db/schema'
import { env } from '#/lib/env'
import { queryKeys } from '#/lib/query-keys'
import { preorderDpAmount } from '#/lib/order-totals'
import { requireUser } from '#/server/fn/order'
import { ACTIVE_RENTAL_STATUSES } from '#/server/fn/rental'
import {
  buildCartView,
  readCart,
  writeCart
  
} from '#/server/fn/cart'
import type {CartItemView} from '#/server/fn/cart';

// ── Ongkir flat per zona (asumsi v1, lihat docs/decisions.md) ────────────────

const ZONES = [
  {
    label: 'Jabodetabek & Jawa Barat',
    fee: 10_000,
    provinces: ['DKI Jakarta', 'Banten', 'Jawa Barat'],
  },
  {
    label: 'Jawa, Bali & Nusa Tenggara',
    fee: 18_000,
    provinces: ['Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur', 'Bali'],
  },
] as const

export function shippingFee(province: string) {
  const zone = ZONES.find((zn) => zn.provinces.includes(province as never))
  if (zone) return { zoneLabel: zone.label, fee: zone.fee }
  return { zoneLabel: 'Luar Jawa', fee: 30_000 }
}

const rupiahInt = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)

// ── Preview checkout ─────────────────────────────────────────────────────────

const checkoutInput = z.object({
  ship: z.boolean(),
  addressId: z.uuid().nullable(),
  notes: z.string().trim().max(500).optional(),
})

export type CheckoutInput = z.infer<typeof checkoutInput>

export type CheckoutPreview = {
  ready: CartItemView[]
  po: CartItemView[]
  rent: CartItemView[]
  readySubtotal: number
  poSubtotal: number
  poDp: number
  rentSubtotal: number
  depositTotal: number
  shipping: {
    ship: boolean
    zoneLabel: string
    fee: number
    feeLabel: string
    addressLabel: string | null
  }
  grandReady: number
  grandPo: number
  grandRent: number
  totalDue: number
  totalDueLabel: string
  invalid: Array<{ variantId: string; mode: string; reason: string }>
}

export async function previewCheckout(input: CheckoutInput): Promise<CheckoutPreview> {
  const user = await requireUser()
  const view = await buildCartView(await readCart())

  const ready = view.items.filter((i) => i.mode === 'buy')
  const po = view.items.filter((i) => i.mode === 'preorder')
  const rent = view.items.filter((i) => i.mode === 'rent')

  const readySubtotal = ready.reduce((s, i) => s + i.lineTotal, 0)
  const poSubtotal = po.reduce((s, i) => s + i.lineTotal, 0)
  const poDp = po.reduce((s, i) => s + preorderDpAmount(i.lineTotal, i.preorderDpPercent), 0)
  const rentSubtotal = rent.reduce((s, i) => s + i.lineTotal, 0)
  const depositTotal = rent.reduce((s, i) => s + i.depositLine, 0)

  let shipZone = { zoneLabel: 'Ambil di toko', fee: 0 }
  let addressLabel: string | null = null
  if (input.ship) {
    if (!input.addressId) throw new Error('ALAMAT_WAJIB')
    const [addr] = await db
      .select()
      .from(addresses)
      .where(and(eq(addresses.id, input.addressId), eq(addresses.userId, user.id)))
      .limit(1)
    if (!addr) throw new Error('ALAMAT_TIDAK_DITEMUKAN')
    shipZone = shippingFee(addr.province)
    addressLabel = `${addr.recipient} — ${addr.street}, ${addr.city}`
  }

  const invalid: CheckoutPreview['invalid'] = ready
    .filter((i) => i.stock < i.qty)
    .map((i) => ({ variantId: i.variantId, mode: i.mode, reason: 'stok kurang' }))
  for (const item of rent) {
    if (!item.isRentable || item.rentPerDay <= 0) {
      invalid.push({ variantId: item.variantId, mode: item.mode, reason: 'tidak dapat disewa' })
    }
    if (!item.rentStart || !item.rentEnd || item.rentDays < 1) {
      invalid.push({ variantId: item.variantId, mode: item.mode, reason: 'periode sewa tidak valid' })
    }
  }

  // Ongkir dikenakan pada order pertama yang dikirim (beli > sewa); PO tanpa ongkir
  const shipTarget = ready.length > 0 ? 'ready' : rent.length > 0 ? 'rent' : null
  const fee = shipTarget ? shipZone.fee : 0

  const grandReady = readySubtotal + (shipTarget === 'ready' ? fee : 0)
  const grandRent = rentSubtotal + depositTotal + (shipTarget === 'rent' ? fee : 0)
  const grandPo = poDp
  const totalDue = grandReady + grandPo + grandRent

  return {
    ready,
    po,
    rent,
    readySubtotal,
    poSubtotal,
    poDp,
    rentSubtotal,
    depositTotal,
    shipping: {
      ship: input.ship,
      zoneLabel: shipZone.zoneLabel,
      fee,
      feeLabel: rupiahInt(fee),
      addressLabel,
    },
    grandReady,
    grandPo,
    grandRent,
    totalDue,
    totalDueLabel: rupiahInt(totalDue),
    invalid,
  }
}

export const getCheckoutPreview = createServerFn({ method: 'POST' })
  .validator(checkoutInput)
  .handler(({ data }) => previewCheckout(data))

export const checkoutPreviewOptions = (input: CheckoutInput) =>
  queryOptions({
    queryKey: queryKeys.checkout(input),
    queryFn: () => getCheckoutPreview({ data: input }),
    staleTime: 0,
  })

// ── Midtrans Snap ────────────────────────────────────────────────────────────

async function createSnap(args: {
  code: string
  grossAmount: number
  customer: { name: string; email: string; phone?: string | null }
  itemLabel: string
}): Promise<{ token: string; redirectUrl: string }> {
  const auth = Buffer.from(`${env.MIDTRANS_SERVER_KEY}:`).toString('base64')
  const res = await fetch(
    env.MIDTRANS_IS_PRODUCTION
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: args.code,
          gross_amount: args.grossAmount,
        },
        item_details: [
          {
            id: args.code,
            price: args.grossAmount,
            quantity: 1,
            name: args.itemLabel.slice(0, 50),
          },
        ],
        customer_details: {
          first_name: args.customer.name,
          email: args.customer.email,
          phone: args.customer.phone ?? undefined,
        },
        expiry: { unit: 'minutes', duration: 30 },
      }),
    },
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`MIDTRANS_${res.status}: ${body.slice(0, 200)}`)
  }
  const json = (await res.json()) as { token: string; redirect_url: string }
  return { token: json.token, redirectUrl: json.redirect_url }
}

export function orderCode() {
  const date = new Date()
  const ymd = [
    date.getFullYear().toString().slice(2),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('')
  return `TTC-${ymd}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`
}

// ── Reservasi unit sewa ──────────────────────────────────────────────────────

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function restockBuyOrder(tx: Tx, orderId: string) {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId))
  for (const item of items) {
    await tx
      .update(productVariants)
      .set({ stock: sql`stock + ${item.qty}` })
      .where(eq(productVariants.id, item.variantId))
  }
}

export async function pickRentUnits(
  tx: Tx,
  args: { variantId: string; qty: number; start: Date; end: Date },
): Promise<string[]> {
  const candidates = await tx
    .select({ id: rentalUnits.id, status: rentalUnits.status })
    .from(rentalUnits)
    .where(eq(rentalUnits.variantId, args.variantId))
    .for('update')

  const ids = candidates.map((c) => c.id)
  const occupied = new Set<string>()
  if (ids.length) {
    const rows = await tx
      .select({ unit: orderItems.rentalUnitId })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          inArray(orderItems.rentalUnitId, ids),
          inArray(orders.status, [...ACTIVE_RENTAL_STATUSES]),
          lt(orderItems.rentStart, args.end),
          gt(orderItems.rentEnd, args.start),
        ),
      )
    for (const row of rows) {
      if (row.unit) occupied.add(row.unit)
    }
  }

  const free = candidates
    .filter((c) => c.status !== 'maintenance' && !occupied.has(c.id))
    .map((c) => c.id)
  if (free.length < args.qty) throw new Error('KUOTA_KURANG')
  return free.slice(0, args.qty)
}

// ── Buat order ───────────────────────────────────────────────────────────────

export type CreatedOrder = {
  id: string
  code: string
  type: 'buy' | 'preorder' | 'rent'
  grandTotal: number
  snapToken: string | null
  snapError: string | null
}

type OrderGroup = {
  type: 'buy' | 'preorder' | 'rent'
  items: CartItemView[]
  subtotal: number
  deposit: number
  shippingFee: number
  grandTotal: number
}

export const createOrder = createServerFn({ method: 'POST' })
  .validator(checkoutInput)
  .handler(async ({ data }): Promise<{ orders: CreatedOrder[]; cartCount: number }> => {
    const user = await requireUser()
    const allLines = await readCart()
    if (allLines.length === 0) throw new Error('KERANJANG_KOSONG')

    const preview = await previewCheckout(data)
    if (preview.invalid.length > 0) throw new Error(
      preview.invalid.some((i) => i.reason.startsWith('stok')) ? 'STOK_KURANG' : 'CHECKOUT_TIDAK_VALID',
    )

    let shipSnapshot: Record<string, unknown> | null = null
    if (data.ship && data.addressId) {
      const [addr] = await db
        .select()
        .from(addresses)
        .where(and(eq(addresses.id, data.addressId), eq(addresses.userId, user.id)))
        .limit(1)
      shipSnapshot = addr ? { ...addr } : null
    }

    const groups: OrderGroup[] = []
    if (preview.ready.length) {
      groups.push({
        type: 'buy',
        items: preview.ready,
        subtotal: preview.readySubtotal,
        deposit: 0,
        shippingFee: preview.ready.length ? preview.shipping.fee : 0,
        grandTotal: preview.grandReady,
      })
    }
    if (preview.rent.length) {
      groups.push({
        type: 'rent',
        items: preview.rent,
        subtotal: preview.rentSubtotal,
        deposit: preview.depositTotal,
        shippingFee: preview.rent.length && !preview.ready.length ? preview.shipping.fee : 0,
        grandTotal: preview.grandRent,
      })
    }
    if (preview.po.length) {
      groups.push({
        type: 'preorder',
        items: preview.po,
        subtotal: preview.poSubtotal,
        deposit: 0,
        shippingFee: 0,
        grandTotal: preview.poDp,
      })
    }

    const created = await db.transaction(async (tx) => {
      const results: Array<{
        id: string
        code: string
        type: 'buy' | 'preorder' | 'rent'
        grandTotal: number
      }> = []

      for (const group of groups) {
        if (group.grandTotal < 1) throw new Error('TOTAL_NOL')

        if (group.type === 'buy') {
          for (const item of group.items) {
            const updated = await tx
              .update(productVariants)
              .set({ stock: sql`stock - ${item.qty}` })
              .where(
                and(eq(productVariants.id, item.variantId), sql`stock >= ${item.qty}`),
              )
              .returning({ id: productVariants.id })
            if (updated.length === 0) throw new Error('STOK_KURANG')
          }
        }

        const code = orderCode()
        const [order] = await tx
          .insert(orders)
          .values({
            code,
            userId: user.id,
            channel: 'web',
            type: group.type,
            status: 'pending_payment',
            subtotal: group.subtotal,
            shippingFee: group.shippingFee,
            depositTotal: group.deposit,
            grandTotal: group.grandTotal,
            shippingAddress: shipSnapshot,
            notes:
              group.type === 'preorder'
                ? [data.notes, `DP ${rupiahInt(group.grandTotal)} — sisa pelunasan saat barang ready`]
                    .filter(Boolean)
                    .join(' | ')
                : (data.notes ?? null),
          })
          .returning({ id: orders.id, code: orders.code, grandTotal: orders.grandTotal })

        if (group.type === 'rent') {
          for (const item of group.items) {
            const unitIds = await pickRentUnits(tx, {
              variantId: item.variantId,
              qty: item.qty,
              start: new Date(item.rentStart as string),
              end: new Date(item.rentEnd as string),
            })
            for (const unitId of unitIds) {
              await tx.insert(orderItems).values({
                orderId: order.id,
                variantId: item.variantId,
                rentalUnitId: unitId,
                nameSnapshot: `${item.name}${item.colorName ? ` — ${item.colorName}` : ''}`,
                unitPrice: item.rentPerDay,
                qty: 1,
                rentStart: new Date(item.rentStart as string),
                rentEnd: new Date(item.rentEnd as string),
                rentDays: item.rentDays,
              })
            }
          }
        } else {
          await tx.insert(orderItems).values(
            group.items.map((item) => ({
              orderId: order.id,
              variantId: item.variantId,
              nameSnapshot: `${item.name}${item.colorName ? ` — ${item.colorName}` : ''}`,
              unitPrice: item.unitPrice,
              qty: item.qty,
            })),
          )
        }

        await tx.insert(payments).values({
          orderId: order.id,
          provider: 'midtrans',
          grossAmount: group.grandTotal,
          status: 'pending',
        })

        await tx.insert(orderStatusLogs).values({
          orderId: order.id,
          toStatus: 'pending_payment',
          note: 'Checkout',
        })

        results.push({
          id: order.id,
          code: order.code,
          type: group.type,
          grandTotal: order.grandTotal,
        })
      }
      return results
    })

    await writeCart([])

    const out: CreatedOrder[] = []
    for (const order of created) {
      try {
        const snap = await createSnap({
          code: order.code,
          grossAmount: order.grandTotal,
          customer: { name: user.name, email: user.email },
          itemLabel:
            order.type === 'preorder'
              ? `DP Pre-Order ${order.code}`
              : order.type === 'rent'
                ? `Sewa ${order.code}`
                : `Pesanan ${order.code}`,
        })
        out.push({ ...order, snapToken: snap.token, snapError: null })
      } catch (error) {
        out.push({
          ...order,
          snapToken: null,
          snapError: error instanceof Error ? error.message : 'Gagal membuat transaksi',
        })
      }
    }

    return { orders: out, cartCount: 0 }
  })

// ── Bayar ulang (Snap token baru) ────────────────────────────────────────────

export const repayOrder = createServerFn({ method: 'POST' })
  .validator((orderId: string) => orderId)
  .handler(async ({ data }): Promise<{ snapToken: string | null; snapError: string | null }> => {
    const user = await requireUser()
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, data), eq(orders.userId, user.id)))
      .limit(1)
    if (!order) throw new Error('ORDER_TIDAK_DITEMUKAN')
    if (order.status !== 'pending_payment') throw new Error('ORDER_BUKAN_PENDING')

    try {
      const snap = await createSnap({
        code: order.code,
        grossAmount: order.grandTotal,
        customer: {
          name: user.name,
          email: user.email,
          phone: (order.shippingAddress as { phone?: string } | null)?.phone,
        },
        itemLabel:
          order.type === 'preorder'
            ? `DP Pre-Order ${order.code}`
            : order.type === 'rent'
              ? `Sewa ${order.code}`
              : `Pesanan ${order.code}`,
      })
      return { snapToken: snap.token, snapError: null }
    } catch (error) {
      return {
        snapToken: null,
        snapError: error instanceof Error ? error.message : 'Gagal membuat transaksi',
      }
    }
  })

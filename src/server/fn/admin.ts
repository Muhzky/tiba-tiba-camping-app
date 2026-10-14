import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, sql, sum } from 'drizzle-orm'
import { hashPassword } from 'better-auth/crypto'
import { db } from '#/server/db'
import {
  accounts,
  attributes,
  auditLogs,
  categories,
  dictionaryTerms,
  orderItems,
  orderStatusLogs,
  orders,
  payments as paymentsTable,
  productAttributeValues,
  productImages,
  productVariants,
  products,
  productSimilarity,
  productVectors,
  rentalReturns,
  rentalUnits,
  userProfileVectors,
  users,
} from '#/server/db/schema'
import { rentalDays } from '#/lib/order-totals'
import { orderCode, pickRentUnits, restockBuyOrder } from '#/server/fn/checkout'
import { slugify } from '#/lib/format'
import { getSessionUser  } from '#/server/fn/auth'
import { rebuildRecommender } from '#/server/recommender/similarity'
import { buildVectorSpace } from '#/server/recommender/vectorize'
import type {SessionUser} from '#/server/fn/auth';
import { ACTIVE_RENTAL_STATUSES } from '#/server/fn/rental'
import { queryKeys } from '#/lib/query-keys'

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
    throw new Error('AKSES_DITOLAK')
  }
  return user
}

export async function requireOwner(): Promise<SessionUser> {
  const user = await requireAdmin()
  if (user.role !== 'owner') throw new Error('AKSES_DITOLAK')
  return user
}

export async function audit(
  actorId: string,
  action: string,
  entity: string,
  entityId?: string,
  diff?: Record<string, unknown>,
) {
  await db.insert(auditLogs).values({
    actorId,
    action,
    entity,
    entityId: entityId ?? null,
    diff: diff ?? null,
  })
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// ── Overview ─────────────────────────────────────────────────────────────────

export type AdminOverview = {
  todayRevenue: number
  monthRevenue: number
  monthOrders: number
  activeRentals: number
  pendingPreorders: number
  lowStock: number
  sales30d: Array<{ date: string; total: number }>
  latestOrders: Array<{
    id: string
    code: string
    customer: string | null
    type: string
    status: string
    grandTotal: number
    createdAt: Date
  }>
  topProducts: Array<{ name: string; qty: number; revenue: number }>
}

export const getAdminOverview = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AdminOverview> => {
    await requireAdmin()
    const now = new Date()
    const dayStart = startOfDay(now)
    const monthStart = startOfMonth(now)

    const [todayRow] = await db
      .select({ v: sum(orders.grandTotal) })
      .from(orders)
      .where(and(eq(orders.paymentStatus, 'paid'), gte(orders.paidAt, dayStart)))
    const [monthRow] = await db
      .select({ v: sum(orders.grandTotal) })
      .from(orders)
      .where(and(eq(orders.paymentStatus, 'paid'), gte(orders.paidAt, monthStart)))

    const [monthOrdersRow] = await db
      .select({ n: count() })
      .from(orders)
      .where(gte(orders.createdAt, monthStart))

    const [rentRow] = await db
      .select({ n: count() })
      .from(orders)
      .where(
        and(
          eq(orders.type, 'rent'),
          inArray(orders.status, [...ACTIVE_RENTAL_STATUSES]),
        ),
      )

    const [poRow] = await db
      .select({ n: count() })
      .from(orders)
      .where(and(eq(orders.type, 'preorder'), inArray(orders.status, ['awaiting_stock', 'pending_payment'])))

    const [lowStockRow] = await db
      .select({ n: count() })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(and(eq(products.isActive, true), sql`${productVariants.stock} <= 3`))

    const paidSince = await db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${orders.paidAt}), 'YYYY-MM-DD')`,
        total: sum(orders.grandTotal),
      })
      .from(orders)
      .where(and(eq(orders.paymentStatus, 'paid'), gte(orders.paidAt, new Date(now.getTime() - 30 * 86_400_000))))
      .groupBy(sql`date_trunc('day', ${orders.paidAt})`)
      .orderBy(sql`date_trunc('day', ${orders.paidAt})`)

    const sales30d: Array<{ date: string; total: number }> = []
    const byDate = new Map(paidSince.map((r) => [r.date, Number(r.total ?? 0)]))
    for (let i = 29; i >= 0; i--) {
      const d = ymd(new Date(now.getTime() - i * 86_400_000))
      sales30d.push({ date: d, total: byDate.get(d) ?? 0 })
    }

    const latest = await db
      .select({
        id: orders.id,
        code: orders.code,
        customer: users.name,
        type: orders.type,
        status: orders.status,
        grandTotal: orders.grandTotal,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .orderBy(desc(orders.createdAt))
      .limit(8)

    const topProducts = await db
      .select({
        name: orderItems.nameSnapshot,
        qty: sum(orderItems.qty),
        revenue: sum(sql`${orderItems.unitPrice} * ${orderItems.qty}`),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          inArray(orders.status, ['paid', 'processing', 'shipped', 'completed', 'rented', 'returned']),
          gte(orders.createdAt, new Date(now.getTime() - 30 * 86_400_000)),
        ),
      )
      .groupBy(orderItems.nameSnapshot)
      .orderBy(desc(sql`sum(${orderItems.qty})`))
      .limit(5)

    return {
      todayRevenue: Number(todayRow?.v ?? 0),
      monthRevenue: Number(monthRow?.v ?? 0),
      monthOrders: Number(monthOrdersRow?.n ?? 0),
      activeRentals: Number(rentRow?.n ?? 0),
      pendingPreorders: Number(poRow?.n ?? 0),
      lowStock: Number(lowStockRow?.n ?? 0),
      sales30d,
      latestOrders: latest,
      topProducts: topProducts.map((t) => ({
        name: t.name,
        qty: Number(t.qty ?? 0),
        revenue: Number(t.revenue ?? 0),
      })),
    }
  },
)

export const adminOverviewOptions = queryOptions({
  queryKey: queryKeys.admin.overview(),
  queryFn: () => getAdminOverview(),
})

// ── Pengguna ─────────────────────────────────────────────────────────────────

export const adminUsersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.int().min(1).default(1),
})

export type AdminUsersResult = {
  rows: Array<{
    id: string
    name: string
    email: string
    role: string
    isActive: boolean
    createdAt: Date
    orderCount: number
    totalSpent: number
  }>
  total: number
  page: number
  pageSize: number
}

export const getAdminUsers = createServerFn({ method: 'GET' })
  .validator((input: z.input<typeof adminUsersSchema>) => adminUsersSchema.parse(input ?? {}))
  .handler(async ({ data }): Promise<AdminUsersResult> => {
    await requireAdmin()
    const pageSize = 20
    const where = data.q ? ilike(users.name, `%${data.q}%`) : undefined

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        orderCount: count(orders.id),
        totalSpent: sum(sql`case when ${orders.paymentStatus} = 'paid' then ${orders.grandTotal} else 0 end`),
      })
      .from(users)
      .leftJoin(orders, eq(orders.userId, users.id))
      .where(where)
      .groupBy(users.id)
      .orderBy(asc(users.createdAt))
      .limit(pageSize)
      .offset((data.page - 1) * pageSize)

    const [totalRow] = await db.select({ n: count() }).from(users).where(where)

    return {
      rows: rows.map((r) => ({
        ...r,
        orderCount: Number(r.orderCount),
        totalSpent: Number(r.totalSpent ?? 0),
      })),
      total: Number(totalRow?.n ?? 0),
      page: data.page,
      pageSize,
    }
  })

export const adminUsersOptions = (params: { q?: string; page?: number }) =>
  queryOptions({
    queryKey: queryKeys.admin.users(params),
    queryFn: () => getAdminUsers({ data: params }),
  })

export const setUserActiveSchema = z.object({
  userId: z.uuid(),
  isActive: z.boolean(),
})

export const setUserActive = createServerFn({ method: 'POST' })
  .validator((input: z.infer<typeof setUserActiveSchema>) => setUserActiveSchema.parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAdmin()
    if (actor.id === data.userId) throw new Error('TIDAK_BISA_UBAH_DIRI_SENDIRI')
    const [target] = await db.select().from(users).where(eq(users.id, data.userId)).limit(1)
    if (!target) throw new Error('USER_TIDAK_DITEMUKAN')
    if (target.role === 'owner' && actor.role !== 'owner') throw new Error('AKSES_DITOLAK')
    await db.update(users).set({ isActive: data.isActive }).where(eq(users.id, data.userId))
    await audit(actor.id, data.isActive ? 'user.activate' : 'user.deactivate', 'user', data.userId)
    return { ok: true as const }
  })

export const setUserRoleSchema = z.object({
  userId: z.uuid(),
  role: z.enum(['customer', 'admin', 'owner']),
})

export const setUserRole = createServerFn({ method: 'POST' })
  .validator((input: z.infer<typeof setUserRoleSchema>) => setUserRoleSchema.parse(input))
  .handler(async ({ data }) => {
    const actor = await requireOwner()
    if (actor.id === data.userId) throw new Error('TIDAK_BISA_UBAH_DIRI_SENDIRI')
    await db.update(users).set({ role: data.role }).where(eq(users.id, data.userId))
    await audit(actor.id, 'user.role', 'user', data.userId, { role: data.role })
    return { ok: true as const }
  })

export const resetPasswordSchema = z.object({
  userId: z.uuid(),
  password: z.string().min(8).max(100),
})

export const resetUserPassword = createServerFn({ method: 'POST' })
  .validator((input: z.infer<typeof resetPasswordSchema>) => resetPasswordSchema.parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAdmin()
    const [cred] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.accountId, data.userId), eq(accounts.providerId, 'credential')))
      .limit(1)
    if (!cred) throw new Error('AKUN_PASSWORD_TIDAK_DITEMUKAN')
    const hashed = await hashPassword(data.password)
    await db.update(accounts).set({ password: hashed }).where(eq(accounts.id, cred.id))
    await audit(actor.id, 'user.reset_password', 'user', data.userId)
    return { ok: true as const }
  })

// ── Produk ───────────────────────────────────────────────────────────────────

export const adminProductsSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
  page: z.int().min(1).default(1),
})

export type AdminProductsResult = {
  rows: Array<{
    id: string
    name: string
    slug: string
    categoryName: string
    salePrice: number
    rentPricePerDay: number | null
    isSellable: boolean
    isRentable: boolean
    isPreorder: boolean
    isActive: boolean
    variantCount: number
    totalStock: number
    imageKey: string | null
  }>
  total: number
  page: number
  pageSize: number
}

export const getAdminProducts = createServerFn({ method: 'GET' })
  .validator((input: z.input<typeof adminProductsSchema>) => adminProductsSchema.parse(input ?? {}))
  .handler(async ({ data }): Promise<AdminProductsResult> => {
    await requireAdmin()
    const pageSize = 20
    const conds = []
    if (data.q) conds.push(ilike(products.name, `%${data.q}%`))
    if (data.status === 'active') conds.push(eq(products.isActive, true))
    if (data.status === 'inactive') conds.push(eq(products.isActive, false))
    const where = conds.length ? and(...conds) : undefined

    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        categoryName: categories.name,
        salePrice: products.salePrice,
        rentPricePerDay: products.rentPricePerDay,
        isSellable: products.isSellable,
        isRentable: products.isRentable,
        isPreorder: products.isPreorder,
        isActive: products.isActive,
        variantCount: count(productVariants.id),
        totalStock: sum(productVariants.stock),
        imageKey: sql<string | null>`min(${productImages.r2Key})`,
      })
      .from(products)
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(productVariants, eq(productVariants.productId, products.id))
      .leftJoin(productImages, eq(productImages.productId, products.id))
      .where(where)
      .groupBy(products.id, categories.name)
      .orderBy(desc(products.createdAt))
      .limit(pageSize)
      .offset((data.page - 1) * pageSize)

    const [totalRow] = await db.select({ n: count() }).from(products).where(where)

    return {
      rows: rows.map((r) => ({
        ...r,
        variantCount: Number(r.variantCount),
        totalStock: Number(r.totalStock ?? 0),
      })),
      total: Number(totalRow?.n ?? 0),
      page: data.page,
      pageSize,
    }
  })

export const adminProductsOptions = (params: {
  q?: string
  status?: 'all' | 'active' | 'inactive'
  page?: number
}) =>
  queryOptions({
    queryKey: queryKeys.admin.products(params),
    queryFn: () => getAdminProducts({ data: params }),
  })

export const getAdminProduct = createServerFn({ method: 'GET' })
  .validator((input: { id: string }) => z.object({ id: z.uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin()
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, data.id))
      .limit(1)
    if (!product) throw new Error('PRODUK_TIDAK_DITEMUKAN')

    const variants = await db
      .select({
        id: productVariants.id,
        sku: productVariants.sku,
        colorName: productVariants.colorName,
        colorHex: productVariants.colorHex,
        size: productVariants.size,
        stock: productVariants.stock,
        salePriceOverride: productVariants.salePriceOverride,
        rentalUnitCount: count(rentalUnits.id),
      })
      .from(productVariants)
      .leftJoin(rentalUnits, eq(rentalUnits.variantId, productVariants.id))
      .where(eq(productVariants.productId, data.id))
      .groupBy(productVariants.id)

    const images = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, data.id))
      .orderBy(productImages.sort)

    const values = await db
      .select({
        attributeId: productAttributeValues.attributeId,
        value: sql<string | number | boolean>`${productAttributeValues.value}`,
        name: attributes.name,
        key: attributes.key,
        type: attributes.type,
        allowedValues: attributes.allowedValues,
        weight: attributes.weight,
      })
      .from(productAttributeValues)
      .innerJoin(attributes, eq(attributes.id, productAttributeValues.attributeId))
      .where(eq(productAttributeValues.productId, data.id))

    return {
      product,
      variants: variants.map((v) => ({ ...v, rentalUnitCount: Number(v.rentalUnitCount) })),
      images,
      values,
    }
  })

export const adminProductDetailOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.admin.product(id),
    queryFn: () => getAdminProduct({ data: { id } }),
  })

export const saveProductSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2).max(160),
  categoryId: z.uuid(),
  description: z.string().max(5000).default(''),
  brandLine: z.string().trim().max(120).optional(),
  salePrice: z.int().positive(),
  discountPercent: z.int().min(0).max(90).default(0),
  rentPricePerDay: z.int().positive().nullable().default(null),
  rentDeposit: z.int().min(0).default(0),
  isSellable: z.boolean().default(true),
  isRentable: z.boolean().default(false),
  isPreorder: z.boolean().default(false),
  preorderEta: z.iso.datetime().nullable().default(null),
  preorderDpPercent: z.int().min(0).max(100).nullable().default(null),
  isActive: z.boolean().default(true),
})

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base)
  let candidate = root
  for (let i = 2; i < 100; i++) {
    const [found] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, candidate))
      .limit(1)
    if (!found || found.id === excludeId) return candidate
    candidate = `${root}-${i}`
  }
  return `${root}-${crypto.randomUUID().slice(0, 6)}`
}

export const saveProduct = createServerFn({ method: 'POST' })
  .validator((input: z.input<typeof saveProductSchema>) => saveProductSchema.parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAdmin()
    const slug = await uniqueSlug(data.name, data.id)
    const values = {
      name: data.name,
      categoryId: data.categoryId,
      description: data.description,
      brandLine: data.brandLine || null,
      salePrice: data.salePrice,
      discountPercent: data.discountPercent,
      rentPricePerDay: data.rentPricePerDay,
      rentDeposit: data.rentDeposit,
      isSellable: data.isSellable,
      isRentable: data.isRentable,
      isPreorder: data.isPreorder,
      preorderEta: data.preorderEta ? new Date(data.preorderEta) : null,
      preorderDpPercent: data.preorderDpPercent,
      isActive: data.isActive,
    }

    if (data.id) {
      await db.update(products).set(values).where(eq(products.id, data.id))
      await audit(actor.id, 'product.update', 'product', data.id)
      scheduleRebuild()
      return { id: data.id, slug }
    }

    const [created] = await db
      .insert(products)
      .values({ ...values, slug })
      .returning({ id: products.id })
    await db.insert(productVariants).values({
      productId: created.id,
      sku: `${slug}-default`,
      stock: 0,
    })
    await audit(actor.id, 'product.create', 'product', created.id)
    scheduleRebuild()
    return { id: created.id, slug }
  })

export const saveVariantSchema = z.object({
  productId: z.uuid(),
  id: z.uuid().optional(),
  sku: z.string().trim().min(2).max(64),
  colorName: z.string().trim().max(60).optional(),
  colorHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  size: z.string().trim().max(40).optional(),
  stock: z.int().min(0).default(0),
  salePriceOverride: z.int().positive().nullable().default(null),
})

export const saveVariant = createServerFn({ method: 'POST' })
  .validator((input: z.input<typeof saveVariantSchema>) => saveVariantSchema.parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAdmin()
    const values = {
      productId: data.productId,
      sku: data.sku,
      colorName: data.colorName || null,
      colorHex: data.colorHex || null,
      size: data.size || null,
      stock: data.stock,
      salePriceOverride: data.salePriceOverride,
    }
    if (data.id) {
      await db.update(productVariants).set(values).where(eq(productVariants.id, data.id))
      await audit(actor.id, 'variant.update', 'variant', data.id)
      return { id: data.id }
    }
    const [created] = await db
      .insert(productVariants)
      .values(values)
      .returning({ id: productVariants.id })
    await audit(actor.id, 'variant.create', 'variant', created.id)
    return { id: created.id }
  })

export const deleteVariant = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => z.object({ id: z.uuid() }).parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAdmin()
    await db.delete(productVariants).where(eq(productVariants.id, data.id))
    await audit(actor.id, 'variant.delete', 'variant', data.id)
    return { ok: true as const }
  })

export const addProductImage = createServerFn({ method: 'POST' })
  .validator(
    (input: { productId: string; r2Key: string; alt?: string }) =>
      z
        .object({
          productId: z.uuid(),
          r2Key: z.string().min(3).max(300),
          alt: z.string().max(200).optional(),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireAdmin()
    const [maxRow] = await db
      .select({ m: sql<number | null>`coalesce(max(${productImages.sort}), -1)` })
      .from(productImages)
      .where(eq(productImages.productId, data.productId))
    const [created] = await db
      .insert(productImages)
      .values({
        productId: data.productId,
        r2Key: data.r2Key,
        alt: data.alt || '',
        sort: Number(maxRow?.m ?? -1) + 1,
      })
      .returning({ id: productImages.id })
    await audit(actor.id, 'product.image_add', 'product', data.productId)
    return { id: created.id }
  })

export const deleteProductImage = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => z.object({ id: z.uuid() }).parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAdmin()
    await db.delete(productImages).where(eq(productImages.id, data.id))
    await audit(actor.id, 'product.image_delete', 'product', data.id)
    return { ok: true as const }
  })

export const duplicateProduct = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => z.object({ id: z.uuid() }).parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAdmin()
    const [src] = await db.select().from(products).where(eq(products.id, data.id)).limit(1)
    if (!src) throw new Error('PRODUK_TIDAK_DITEMUKAN')
    const slug = await uniqueSlug(`${src.name} salinan`)
    const [{ id: newId }] = await db
      .insert(products)
      .values({
        ...src,
        id: undefined,
        name: `${src.name} (Salinan)`,
        slug,
        createdAt: undefined,
      })
      .returning({ id: products.id })

    const srcVariants = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, data.id))
    if (srcVariants.length) {
      await db.insert(productVariants).values(
        srcVariants.map((v) => ({
          productId: newId,
          sku: `${slug}-${v.sku.slice(-8)}`,
          colorName: v.colorName,
          colorHex: v.colorHex,
          size: v.size,
          stock: 0,
          salePriceOverride: v.salePriceOverride,
        })),
      )
    }
    await audit(actor.id, 'product.duplicate', 'product', newId, { from: data.id })
    scheduleRebuild()
    return { id: newId }
  })

export const toggleProductActive = createServerFn({ method: 'POST' })
  .validator(
    (input: { id: string; isActive: boolean }) =>
      z.object({ id: z.uuid(), isActive: z.boolean() }).parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireAdmin()
    await db.update(products).set({ isActive: data.isActive }).where(eq(products.id, data.id))
    await audit(actor.id, 'product.toggle_active', 'product', data.id, {
      isActive: data.isActive,
    })
    scheduleRebuild()
    return { ok: true as const }
  })

export const saveProductAttributesSchema = z.object({
  productId: z.uuid(),
  values: z.array(z.object({ attributeId: z.uuid(), value: z.unknown() })).max(50),
})

export const saveProductAttributes = createServerFn({ method: 'POST' })
  .validator((input: z.infer<typeof saveProductAttributesSchema>) =>
    saveProductAttributesSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireAdmin()
    await db
      .delete(productAttributeValues)
      .where(eq(productAttributeValues.productId, data.productId))
    if (data.values.length) {
      await db.insert(productAttributeValues).values(
        data.values.map((v) => ({
          productId: data.productId,
          attributeId: v.attributeId,
          value: v.value as never,
        })),
      )
    }
    await audit(actor.id, 'product.attributes', 'product', data.productId)
    scheduleRebuild()
    return { ok: true as const }
  })

// Antrean rebuild: non-blocking, serial — supaya simpan admin tidak menunggu O(n²).
let rebuildQueue: Promise<unknown> = Promise.resolve()
function scheduleRebuild(): void {
  rebuildQueue = rebuildQueue
    .catch(() => {})
    .then(() => rebuildRecommender())
    .catch((e) => console.error('recommender rebuild failed:', e))
}

// ── Transaksi ────────────────────────────────────────────────────────────────

export const ORDER_TRANSITIONS: Record<string, string[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['shipped', 'ready_pickup', 'completed', 'cancelled'],
  shipped: ['completed'],
  ready_pickup: ['completed'],
  awaiting_stock: ['processing', 'cancelled'],
  rented: ['returned', 'overdue'],
  overdue: ['returned'],
  returned: ['completed', 'refunded'],
  completed: [],
  cancelled: [],
  expired: [],
  refunded: [],
}

export const adminOrdersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.string().max(30).default('all'),
  type: z.enum(['all', 'buy', 'rent', 'preorder']).default('all'),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  page: z.int().min(1).default(1),
})

function adminOrderWhere(data: z.infer<typeof adminOrdersSchema>) {
  const conds = []
  if (data.q) {
    conds.push(
      sql`(${orders.code} ilike ${'%' + data.q + '%'} or ${users.name} ilike ${'%' + data.q + '%'})`,
    )
  }
  if (data.status !== 'all') conds.push(sql`${orders.status} = ${data.status}`)
  if (data.type !== 'all') conds.push(eq(orders.type, data.type))
  if (data.from) conds.push(gte(orders.createdAt, new Date(data.from)))
  if (data.to) conds.push(lte(orders.createdAt, new Date(data.to)))
  return conds.length ? and(...conds) : undefined
}

export const getAdminOrders = createServerFn({ method: 'GET' })
  .validator((input: z.input<typeof adminOrdersSchema>) => adminOrdersSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    await requireAdmin()
    const pageSize = 20
    const where = adminOrderWhere(data)
    const rows = await db
      .select({
        id: orders.id,
        code: orders.code,
        customer: users.name,
        channel: orders.channel,
        type: orders.type,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        grandTotal: orders.grandTotal,
        itemCount: count(orderItems.id),
        createdAt: orders.createdAt,
        paidAt: orders.paidAt,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(where)
      .groupBy(orders.id, users.name)
      .orderBy(desc(orders.createdAt))
      .limit(pageSize)
      .offset((data.page - 1) * pageSize)

    const [totalRow] = await db
      .select({ n: count() })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(where)

    return {
      rows: rows.map((r) => ({ ...r, itemCount: Number(r.itemCount) })),
      total: Number(totalRow?.n ?? 0),
      page: data.page,
      pageSize,
    }
  })

export const adminOrdersOptions = (params: Partial<z.infer<typeof adminOrdersSchema>>) =>
  queryOptions({
    queryKey: queryKeys.admin.orders(params),
    queryFn: () => getAdminOrders({ data: params }),
  })

export const exportAdminOrders = createServerFn({ method: 'GET' })
  .validator((input: z.input<typeof adminOrdersSchema>) => adminOrdersSchema.parse(input ?? {}))
  .handler(async ({ data }): Promise<string> => {
    await requireAdmin()
    const rows = await db
      .select({
        code: orders.code,
        customer: users.name,
        channel: orders.channel,
        type: orders.type,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        grandTotal: orders.grandTotal,
        createdAt: orders.createdAt,
        paidAt: orders.paidAt,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(adminOrderWhere({ ...data, page: 1 }))
      .orderBy(desc(orders.createdAt))
      .limit(2000)

    const esc = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`
    const header = ['kode', 'pelanggan', 'channel', 'tipe', 'status', 'pembayaran', 'total', 'dibuat', 'dibayar']
    const lines = rows.map((r) =>
      [
        r.code,
        r.customer ?? 'Walk-in',
        r.channel,
        r.type,
        r.status,
        r.paymentStatus,
        r.grandTotal,
        r.createdAt.toISOString(),
        r.paidAt?.toISOString() ?? '',
      ]
        .map(esc)
        .join(','),
    )
    return [header.join(','), ...lines].join('\n')
  })

export const getAdminOrder = createServerFn({ method: 'GET' })
  .validator((input: { id: string }) => z.object({ id: z.uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin()
    const [row] = await db
      .select({
        order: orders,
        customer: users.name,
        customerEmail: users.email,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(eq(orders.id, data.id))
      .limit(1)
    if (!row) throw new Error('ORDER_TIDAK_DITEMUKAN')
    const order = {
      order: {
        ...row.order,
        shippingAddress: (row.order.shippingAddress ?? null) as Record<string, string> | null,
      },
      customer: row.customer,
      customerEmail: row.customerEmail,
    }

    const items = await db
      .select({
        id: orderItems.id,
        name: orderItems.nameSnapshot,
        unitPrice: orderItems.unitPrice,
        qty: orderItems.qty,
        rentStart: orderItems.rentStart,
        rentEnd: orderItems.rentEnd,
        rentDays: orderItems.rentDays,
        rentalUnitSerial: rentalUnits.serialCode,
      })
      .from(orderItems)
      .leftJoin(rentalUnits, eq(rentalUnits.id, orderItems.rentalUnitId))
      .where(eq(orderItems.orderId, data.id))

    const logs = await db
      .select()
      .from(orderStatusLogs)
      .where(eq(orderStatusLogs.orderId, data.id))
      .orderBy(orderStatusLogs.createdAt)

    const paymentRows = await db
      .select({
        id: paymentsTable.id,
        provider: paymentsTable.provider,
        grossAmount: paymentsTable.grossAmount,
        status: paymentsTable.status,
        signatureValid: paymentsTable.signatureValid,
        createdAt: paymentsTable.createdAt,
      })
      .from(paymentsTable)
      .where(eq(paymentsTable.orderId, data.id))

    const returns = await db
      .select()
      .from(rentalReturns)
      .innerJoin(orderItems, eq(orderItems.id, rentalReturns.orderItemId))
      .where(eq(orderItems.orderId, data.id))

    return {
      ...order,
      items,
      logs,
      payments: paymentRows,
      returns: returns.map((r) => r.rental_returns),
      allowed: ORDER_TRANSITIONS[order.order.status] ?? [],
    }
  })

export const adminOrderDetailOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.admin.order(id),
    queryFn: () => getAdminOrder({ data: { id } }),
  })

export const updateOrderStatusSchema = z.object({
  orderId: z.uuid(),
  to: z.enum([
    'paid',
    'processing',
    'shipped',
    'ready_pickup',
    'completed',
    'cancelled',
    'overdue',
    'refunded',
  ]),
  note: z.string().trim().max(300).optional(),
  trackingNo: z.string().trim().max(80).optional(),
})

export const updateOrderStatus = createServerFn({ method: 'POST' })
  .validator((input: z.infer<typeof updateOrderStatusSchema>) => updateOrderStatusSchema.parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAdmin()
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, data.orderId))
      .limit(1)
    if (!order) throw new Error('ORDER_TIDAK_DITEMUKAN')
    const allowed = ORDER_TRANSITIONS[order.status] ?? []
    if (!allowed.includes(data.to)) throw new Error('TRANSISI_STATUS_TIDAK_VALID')
    if (data.to === 'shipped' && !data.trackingNo) throw new Error('NOMOR_RESI_WAJIB')

    await db.transaction(async (tx) => {
      await tx
        .update(orders)
        .set({
          status: data.to,
          ...(data.trackingNo ? { trackingNo: data.trackingNo } : {}),
          ...(data.to === 'paid' && !order.paidAt ? { paidAt: new Date() } : {}),
        })
        .where(eq(orders.id, data.orderId))
      await tx.insert(orderStatusLogs).values({
        orderId: data.orderId,
        fromStatus: order.status,
        toStatus: data.to,
        actorId: actor.id,
        note: data.note || null,
      })
      if (data.to === 'cancelled' && order.type === 'buy') {
        await restockBuyOrder(tx, data.orderId)
      }
    })
    await audit(actor.id, 'order.status', 'order', data.orderId, {
      from: order.status,
      to: data.to,
    })
    return { ok: true as const }
  })

export const rentalReturnSchema = z.object({
  orderId: z.uuid(),
  conditionNote: z.string().trim().max(300).optional(),
  lateDays: z.int().min(0).default(0),
  lateFee: z.int().min(0).default(0),
  damageFee: z.int().min(0).default(0),
  depositRefund: z.int().min(0).default(0),
})

export const returnRental = createServerFn({ method: 'POST' })
  .validator((input: z.infer<typeof rentalReturnSchema>) => rentalReturnSchema.parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAdmin()
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, data.orderId))
      .limit(1)
    if (!order) throw new Error('ORDER_TIDAK_DITEMUKAN')
    if (order.type !== 'rent') throw new Error('BAKAN_ORDER_SEWA')
    if (!['rented', 'overdue'].includes(order.status)) throw new Error('STATUS_SEWA_TIDAK_VALID')

    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, data.orderId))

    await db.transaction(async (tx) => {
      for (const item of items) {
        await tx.insert(rentalReturns).values({
          orderItemId: item.id,
          conditionNote: data.conditionNote || null,
          lateDays: data.lateDays,
          lateFee: data.lateFee,
          damageFee: data.damageFee,
          depositRefund: data.depositRefund,
        })
        if (item.rentalUnitId) {
          await tx
            .update(rentalUnits)
            .set({ status: 'available' })
            .where(eq(rentalUnits.id, item.rentalUnitId))
        }
      }
      await tx
        .update(orders)
        .set({ status: 'returned' })
        .where(eq(orders.id, data.orderId))
      await tx.insert(orderStatusLogs).values({
        orderId: data.orderId,
        fromStatus: order.status,
        toStatus: 'returned',
        actorId: actor.id,
        note: `Pengembalian${data.lateDays ? ` · telat ${data.lateDays} hari` : ''}${
          data.damageFee ? ` · denda kerusakan ${data.damageFee}` : ''
        }`,
      })
    })
    await audit(actor.id, 'order.return_rental', 'order', data.orderId, {
      lateDays: data.lateDays,
      lateFee: data.lateFee,
      damageFee: data.damageFee,
      depositRefund: data.depositRefund,
    })
    return { ok: true as const }
  })

// ── POS Kasir ────────────────────────────────────────────────────────────────

export const posOrderSchema = z
  .object({
    mode: z.enum(['buy', 'rent']),
    paymentMethod: z.enum(['cash', 'qris']),
    customerName: z.string().trim().max(120).optional(),
    rentStart: z.iso.datetime().optional(),
    rentEnd: z.iso.datetime().optional(),
    items: z
      .array(z.object({ variantId: z.uuid(), qty: z.int().positive().max(50) }))
      .min(1)
      .max(30),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'rent') {
      if (!v.rentStart || !v.rentEnd) {
        ctx.addIssue({ code: 'custom', message: 'Tanggal sewa wajib diisi', path: ['rentStart'] })
      } else if (new Date(v.rentEnd) <= new Date(v.rentStart)) {
        ctx.addIssue({ code: 'custom', message: 'Tanggal selesai harus setelah mulai', path: ['rentEnd'] })
      }
    }
  })

export async function createPosOrderCore(
  data: z.infer<typeof posOrderSchema>,
  actor: { id: string; name: string },
): Promise<{ orderId: string }> {
  const variantIds = data.items.map((i) => i.variantId)
  const catalog = await db
    .select({
      variantId: productVariants.id,
      stock: productVariants.stock,
      productId: products.id,
      name: products.name,
      salePrice: products.salePrice,
      discountPercent: products.discountPercent,
      rentPricePerDay: products.rentPricePerDay,
      rentDeposit: products.rentDeposit,
      isRentable: products.isRentable,
      isActive: products.isActive,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(inArray(productVariants.id, variantIds))
  const byId = new Map(catalog.map((r) => [r.variantId, r]))

  const rentStart = data.rentStart ? new Date(data.rentStart) : null
  const rentEnd = data.rentEnd ? new Date(data.rentEnd) : null
  const rentDays = rentStart && rentEnd ? rentalDays(rentStart, rentEnd) : 0

  let subtotal = 0
  let depositTotal = 0
  const lines = data.items.map((line) => {
    const row = byId.get(line.variantId)
    if (!row || !row.isActive) throw new Error('PRODUK_TIDAK_DITEMUKAN')
    if (data.mode === 'rent') {
      if (!row.isRentable || !row.rentPricePerDay) throw new Error('PRODUK_TIDAK_DISEWAKAN')
      subtotal += row.rentPricePerDay * rentDays * line.qty
      depositTotal += row.rentDeposit * line.qty
    } else {
      const unit = Math.round(row.salePrice - (row.salePrice * row.discountPercent) / 100)
      if (row.stock < line.qty) throw new Error('STOK_KURANG')
      subtotal += unit * line.qty
    }
    return { ...line, row }
  })

  const grandTotal = subtotal + depositTotal
  const orderId = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        code: orderCode(),
        userId: null,
        channel: 'pos',
        type: data.mode,
        status: 'paid',
        subtotal,
        depositTotal,
        grandTotal,
        paymentStatus: 'paid',
        paidAt: new Date(),
        notes: [
          `POS ${data.paymentMethod.toUpperCase()}`,
          data.customerName ? `Pelanggan: ${data.customerName}` : null,
          `Kasir: ${actor.name}`,
        ]
          .filter(Boolean)
          .join(' · '),
      })
      .returning({ id: orders.id })

    for (const line of lines) {
      if (data.mode === 'buy') {
        const updated = await tx
          .update(productVariants)
          .set({ stock: sql`stock - ${line.qty}` })
          .where(
            and(eq(productVariants.id, line.variantId), sql`${productVariants.stock} >= ${line.qty}`),
          )
          .returning({ id: productVariants.id })
        if (updated.length === 0) throw new Error('STOK_KURANG')
        await tx.insert(orderItems).values({
          orderId: order.id,
          variantId: line.variantId,
          nameSnapshot: line.row.name,
          unitPrice: Math.round(
            line.row.salePrice - (line.row.salePrice * line.row.discountPercent) / 100,
          ),
          qty: line.qty,
        })
      } else {
        const unitIds = await pickRentUnits(tx, {
          variantId: line.variantId,
          qty: line.qty,
          start: rentStart as Date,
          end: rentEnd as Date,
        })
        for (const unitId of unitIds) {
          await tx.insert(orderItems).values({
            orderId: order.id,
            variantId: line.variantId,
            rentalUnitId: unitId,
            nameSnapshot: line.row.name,
            unitPrice: line.row.rentPricePerDay ?? 0,
            qty: 1,
            rentStart,
            rentEnd,
            rentDays,
          })
        }
      }
    }

    await tx.insert(paymentsTable).values({
      orderId: order.id,
      provider: data.paymentMethod,
      grossAmount: grandTotal,
      status: 'paid',
      signatureValid: true,
    })
    await tx.insert(orderStatusLogs).values({
      orderId: order.id,
      fromStatus: null,
      toStatus: 'paid',
      actorId: actor.id,
      note: `POS — pembayaran ${data.paymentMethod.toUpperCase()}`,
    })
    return order.id
  })

  await audit(actor.id, 'order.pos', 'order', orderId, {
    mode: data.mode,
    paymentMethod: data.paymentMethod,
    grandTotal,
  })
  return { orderId }
}

export const createPosOrder = createServerFn({ method: 'POST' })
  .validator((input: z.infer<typeof posOrderSchema>) => posOrderSchema.parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAdmin()
    return createPosOrderCore(data, actor)
  })

export const posVariantsSchema = z.object({ q: z.string().trim().max(80).optional() })

export const searchPosVariants = createServerFn({ method: 'GET' })
  .validator((input: z.input<typeof posVariantsSchema>) => posVariantsSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    await requireAdmin()
    const conds = [eq(products.isActive, true)]
    if (data.q) conds.push(ilike(products.name, `%${data.q}%`))
    return db
      .select({
        variantId: productVariants.id,
        sku: productVariants.sku,
        stock: productVariants.stock,
        name: products.name,
        salePrice: products.salePrice,
        discountPercent: products.discountPercent,
        rentPricePerDay: products.rentPricePerDay,
        rentDeposit: products.rentDeposit,
        isRentable: products.isRentable,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(and(...conds))
      .orderBy(products.name)
      .limit(30)
  })

export const posVariantsOptions = (q: string) =>
  queryOptions({
    queryKey: queryKeys.admin.posVariants(q),
    queryFn: () => searchPosVariants({ data: { q: q || undefined } }),
  })

// ── Atribut & Kamus ──────────────────────────────────────────────────────────

export const getAttributes = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  return db.select().from(attributes).orderBy(attributes.name)
})

export const attributesOptions = queryOptions({
  queryKey: queryKeys.admin.attributes(),
  queryFn: () => getAttributes(),
})

export const saveAttributeSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2).max(80),
  key: z.string().trim().min(2).max(40).optional(),
  type: z.enum(['text', 'enum', 'number', 'boolean']).default('text'),
  allowedValues: z.array(z.union([z.string(), z.number(), z.boolean()])).max(50).default([]),
  weight: z.number().min(0).max(10).default(1),
  isFilterable: z.boolean().default(true),
  showInSpec: z.boolean().default(true),
})

export const saveAttribute = createServerFn({ method: 'POST' })
  .validator((input: z.input<typeof saveAttributeSchema>) => saveAttributeSchema.parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAdmin()
    const values = {
      name: data.name,
      key: slugify(data.key || data.name),
      type: data.type,
      allowedValues: data.allowedValues.length ? (data.allowedValues as never) : null,
      weight: data.weight,
      isFilterable: data.isFilterable,
      showInSpec: data.showInSpec,
    }
    if (data.id) {
      await db.update(attributes).set(values).where(eq(attributes.id, data.id))
      await audit(actor.id, 'attribute.update', 'attribute', data.id)
      scheduleRebuild()
      return { id: data.id }
    }
    const [created] = await db
      .insert(attributes)
      .values(values)
      .returning({ id: attributes.id })
    await audit(actor.id, 'attribute.create', 'attribute', created.id)
    scheduleRebuild()
    return { id: created.id }
  })

export const deleteAttribute = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => z.object({ id: z.uuid() }).parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAdmin()
    await db.delete(attributes).where(eq(attributes.id, data.id))
    await audit(actor.id, 'attribute.delete', 'attribute', data.id)
    scheduleRebuild()
    return { ok: true as const }
  })

export const dictionarySchema = z.object({
  q: z.string().trim().max(80).optional(),
  kind: z.enum(['all', 'synonym', 'tag', 'stopword']).default('all'),
  page: z.int().min(1).default(1),
})

export const getDictionaryTerms = createServerFn({ method: 'GET' })
  .validator((input: z.input<typeof dictionarySchema>) => dictionarySchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    await requireAdmin()
    const pageSize = 20
    const conds = []
    if (data.q) {
      conds.push(
        sql`${dictionaryTerms.term} ilike ${'%' + data.q + '%'} or ${dictionaryTerms.canonical} ilike ${'%' + data.q + '%'}`,
      )
    }
    if (data.kind !== 'all') conds.push(eq(dictionaryTerms.kind, data.kind))
    const where = conds.length ? and(...conds) : undefined

    const rows = await db
      .select()
      .from(dictionaryTerms)
      .where(where)
      .orderBy(dictionaryTerms.kind, dictionaryTerms.term)
      .limit(pageSize)
      .offset((data.page - 1) * pageSize)
    const [totalRow] = await db.select({ n: count() }).from(dictionaryTerms).where(where)

    return { rows, total: Number(totalRow?.n ?? 0), page: data.page, pageSize }
  })

export const dictionaryOptions = (params: {
  q?: string
  kind?: 'all' | 'synonym' | 'tag' | 'stopword'
  page?: number
}) =>
  queryOptions({
    queryKey: queryKeys.admin.dictionary(params),
    queryFn: () => getDictionaryTerms({ data: params }),
  })

export const saveTermSchema = z.object({
  id: z.uuid().optional(),
  term: z.string().trim().min(1).max(80),
  canonical: z.string().trim().min(1).max(80),
  kind: z.enum(['synonym', 'tag', 'stopword']).default('synonym'),
})

export const saveTerm = createServerFn({ method: 'POST' })
  .validator((input: z.input<typeof saveTermSchema>) => saveTermSchema.parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAdmin()
    const values = { term: data.term, canonical: data.canonical, kind: data.kind }
    if (data.id) {
      await db.update(dictionaryTerms).set(values).where(eq(dictionaryTerms.id, data.id))
      await audit(actor.id, 'dictionary.update', 'dictionary', data.id)
      scheduleRebuild()
      return { id: data.id }
    }
    const [created] = await db
      .insert(dictionaryTerms)
      .values(values)
      .returning({ id: dictionaryTerms.id })
    await audit(actor.id, 'dictionary.create', 'dictionary', created.id)
    scheduleRebuild()
    return { id: created.id }
  })

export const deleteTerm = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => z.object({ id: z.uuid() }).parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAdmin()
    await db.delete(dictionaryTerms).where(eq(dictionaryTerms.id, data.id))
    await audit(actor.id, 'dictionary.delete', 'dictionary', data.id)
    scheduleRebuild()
    return { ok: true as const }
  })

// ── Rekomendasi (debug) ──────────────────────────────────────────────────────

export const getRecommenderStats = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  const [p, v, s, u] = await Promise.all([
    db.select({ n: count() }).from(products),
    db.select({ n: count() }).from(productVectors),
    db.select({ n: count() }).from(productSimilarity),
    db.select({ n: count() }).from(userProfileVectors),
  ])
  return {
    products: Number(p[0]?.n ?? 0),
    vectors: Number(v[0]?.n ?? 0),
    similarities: Number(s[0]?.n ?? 0),
    profiles: Number(u[0]?.n ?? 0),
  }
})

export const recommenderStatsOptions = queryOptions({
  queryKey: queryKeys.admin.recommender(),
  queryFn: () => getRecommenderStats(),
})

export const getRecommenderProductDebug = createServerFn({ method: 'GET' })
  .validator((id: string) => z.string().uuid().parse(id))
  .handler(async ({ data: id }) => {
    await requireAdmin()
    const [prod] = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.id, id))
      .limit(1)
    if (!prod) throw new Error('PRODUK_TIDAK_DITEMUKAN')

    const space = await buildVectorSpace()
    const vecRows = await db
      .select({ vector: productVectors.vector, version: productVectors.version })
      .from(productVectors)
      .where(eq(productVectors.productId, id))
      .limit(1)
    const vecRow: (typeof vecRows)[number] | undefined = vecRows[0]
    // vocab disusun ulang secara deterministik (sorted) — label bisa meleset
    // sampai rebuild berikutnya bila kamus berubah (diterima, tanpa tabel vocab).
    const terms = vecRow
      ? space.vocab
          .map((term, i) => ({ term, weight: vecRow.vector[i] ?? 0 }))
          .filter((t) => t.weight > 0)
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 20)
      : []

    const similar = await db
      .select({
        id: productSimilarity.similarId,
        score: productSimilarity.score,
        name: products.name,
      })
      .from(productSimilarity)
      .innerJoin(products, eq(products.id, productSimilarity.similarId))
      .where(eq(productSimilarity.productId, id))
      .orderBy(desc(productSimilarity.score))
      .limit(10)

    return { name: prod.name, vocabSize: space.vocab.length, hasVector: Boolean(vecRow), terms, similar }
  })

export const recommenderProductOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.admin.recommenderProduct(id),
    queryFn: () => getRecommenderProductDebug({ data: id }),
  })

export const rebuildRecommenderNow = createServerFn({ method: 'POST' }).handler(async () => {
  await requireAdmin()
  return rebuildRecommender()
})

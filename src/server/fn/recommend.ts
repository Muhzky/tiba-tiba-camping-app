import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#/server/db'
import {
  orderItems,
  orders,
  productSimilarity,
  productVariants,
  productVectors,
  products,
} from '#/server/db/schema'
import { queryKeys } from '#/lib/query-keys'
import { getSessionUser } from '#/server/fn/auth'
import { fetchCardsByIds } from '#/server/fn/product'
import type { ProductCardData } from '#/server/fn/product'
import { cosineArrays } from '#/server/recommender/similarity'
import { getUserProfile } from '#/server/recommender/profile'

export type RecReason = 'personal' | 'popular' | 'baru'

export const REASON_LABEL: Record<RecReason, string> = {
  personal: 'Sesuai preferensimu',
  popular: 'Populer minggu ini',
  baru: 'Baru masuk toko',
}

export type RecCandidate = {
  id: string
  categoryId: string
  vector: number[] | null
  active: boolean
  isPreorder: boolean
  stock: number
  soldCount: number
  createdAt: Date
  purchased: boolean
}

export function pickForUser(opts: {
  profile: number[] | null
  candidates: RecCandidate[]
  limit: number
}): Array<{ id: string; reason: RecReason }> {
  const pool = opts.candidates.filter(
    (c) => c.active && (c.stock > 0 || c.isPreorder) && !c.purchased,
  )
  const scored = pool.map((c) => ({
    c,
    score: opts.profile && c.vector ? cosineArrays(opts.profile, c.vector) : 0,
  }))
  scored.sort((a, b) => {
    if (opts.profile && b.score !== a.score) return b.score - a.score
    if (b.c.soldCount !== a.c.soldCount) return b.c.soldCount - a.c.soldCount
    return b.c.createdAt.getTime() - a.c.createdAt.getTime()
  })

  const counts = new Map<string, number>()
  const picked: typeof scored = []
  for (const s of scored) {
    if (picked.length >= opts.limit) break
    const n = counts.get(s.c.categoryId) ?? 0
    if (n >= 3) continue
    counts.set(s.c.categoryId, n + 1)
    picked.push(s)
  }
  for (const s of scored) {
    if (picked.length >= opts.limit) break
    if (!picked.includes(s)) picked.push(s)
  }

  return picked.map(({ c, score }) => ({
    id: c.id,
    reason: opts.profile && score > 0 ? 'personal' : c.soldCount > 0 ? 'popular' : 'baru',
  }))
}

async function loadCandidates(): Promise<RecCandidate[]> {
  const [base, soldRows, boughtRows, vecRows] = await Promise.all([
    db
      .select({
        id: products.id,
        categoryId: products.categoryId,
        active: products.isActive,
        isPreorder: products.isPreorder,
        createdAt: products.createdAt,
        stock: sql<number>`coalesce(sum(${productVariants.stock}), 0)`,
      })
      .from(products)
      .leftJoin(productVariants, eq(productVariants.productId, products.id))
      .groupBy(products.id),
    db
      .select({ productId: productVariants.productId, n: count() })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
      .where(
        inArray(orders.status, [
          'paid',
          'processing',
          'shipped',
          'ready_pickup',
          'completed',
          'returned',
        ]),
      )
      .groupBy(productVariants.productId),
    getSessionUser().then(async (user) => {
      if (!user) return []
      return db
        .select({ productId: productVariants.productId })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
        .where(eq(orders.userId, user.id))
    }),
    db
      .select({ id: productVectors.productId, vector: productVectors.vector })
      .from(productVectors),
  ])

  const soldMap = new Map(soldRows.map((r) => [r.productId, r.n]))
  const vecMap = new Map(vecRows.map((r) => [r.id, r.vector]))
  const purchased = new Set(boughtRows.map((r) => r.productId))

  return base.map((r) => ({
    id: r.id,
    categoryId: r.categoryId,
    active: r.active,
    isPreorder: r.isPreorder,
    stock: Number(r.stock),
    createdAt: r.createdAt,
    soldCount: soldMap.get(r.id) ?? 0,
    vector: vecMap.get(r.id) ?? null,
    purchased: purchased.has(r.id),
  }))
}

const recsSchema = z.object({ limit: z.int().min(1).max(24).default(8) })

export type RecommendationsResult = {
  personalized: boolean
  items: Array<{ product: ProductCardData; reason: RecReason }>
}

export const getRecommendations = createServerFn({ method: 'GET' })
  .validator((input: z.input<typeof recsSchema>) => recsSchema.parse(input ?? {}))
  .handler(async ({ data }): Promise<RecommendationsResult> => {
    const [candidates, user] = await Promise.all([loadCandidates(), getSessionUser()])
    const profile = user ? await getUserProfile(user.id) : null
    const picked = pickForUser({ profile, candidates, limit: data.limit })
    const cards = await fetchCardsByIds(picked.map((p) => p.id))
    const reasonById = new Map(picked.map((p) => [p.id, p.reason]))
    return {
      personalized: profile != null,
      items: cards.map((product) => ({
        product,
        reason: reasonById.get(product.id) ?? 'popular',
      })),
    }
  })

export const recommendationsOptions = (limit = 8) =>
  queryOptions({
    queryKey: queryKeys.products.recs(limit),
    queryFn: () => getRecommendations({ data: { limit } }),
  })

export async function similarProductIds(productId: string, limit = 4): Promise<string[]> {
  const rows = await db
    .select({ id: productSimilarity.similarId })
    .from(productSimilarity)
    .innerJoin(products, eq(products.id, productSimilarity.similarId))
    .where(and(eq(productSimilarity.productId, productId), eq(products.isActive, true)))
    .orderBy(desc(productSimilarity.score))
    .limit(limit)
  return rows.map((r) => r.id)
}

export async function rankActiveProductIds(userId: string | null): Promise<string[]> {
  const candidates = await loadCandidates()
  // katalog tetap menampilkan produk yang pernah dibeli (relevansi saja, bukan filter)
  for (const c of candidates) c.purchased = false
  const profile = userId ? await getUserProfile(userId) : null
  const picked = pickForUser({ profile, candidates, limit: candidates.length })
  const ranked = picked.map((p) => p.id)
  const rankedSet = new Set(ranked)
  return [...ranked, ...candidates.filter((c) => !rankedSet.has(c.id)).map((c) => c.id)]
}

import { and, count, eq, inArray, isNotNull } from 'drizzle-orm'
import { db } from '#/server/db'
import {
  favorites,
  orderItems,
  orders,
  productVariants,
  productVectors,
  products,
} from '#/server/db/schema'
import { cosineArrays } from './similarity'

export const EVAL_KS = [4, 8, 12] as const

// status order yang dianggap pembelian positif (bukan cancelled/expired/refunded)
const PURCHASED_STATUSES = [
  'paid',
  'processing',
  'shipped',
  'ready_pickup',
  'completed',
  'returned',
] as const

export function precisionAtK(recommended: string[], relevant: Set<string>, k: number): number {
  if (k <= 0) return 0
  let hits = 0
  for (const id of recommended.slice(0, k)) if (relevant.has(id)) hits++
  return hits / k
}

export function recallAtK(recommended: string[], relevant: Set<string>, k: number): number {
  if (k <= 0 || relevant.size === 0) return 0
  let hits = 0
  for (const id of recommended.slice(0, k)) if (relevant.has(id)) hits++
  return hits / relevant.size
}

export type EvalMetric = { k: number; precision: number; recall: number }

export type EvaluationResult = {
  users: number
  candidates: number
  ks: number[]
  cbf: EvalMetric[]
  baseline: EvalMetric[]
}

type Pointer = { id: string; at: number }

/**
 * Evaluasi offline leave-one-out:
 * untuk tiap user, item positif terbaru dijadikan ground-truth, sisanya jadi
 * profil; bandingkan ranking CBF vs baseline popularitas.
 * ponytail: skala demo (O(user × produk)); pakai pgvector/ANN bila produk besar.
 */
export async function evaluateRecommender(ks: number[] = [...EVAL_KS]): Promise<EvaluationResult> {
  const [vecRows, activeRows, soldRows, favRows, buyRows] = await Promise.all([
    db
      .select({ id: productVectors.productId, vector: productVectors.vector })
      .from(productVectors),
    db.select({ id: products.id }).from(products).where(eq(products.isActive, true)),
    db
      .select({ productId: productVariants.productId, n: count() })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
      .where(inArray(orders.status, [...PURCHASED_STATUSES]))
      .groupBy(productVariants.productId),
    db
      .select({ userId: favorites.userId, productId: favorites.productId, at: favorites.createdAt })
      .from(favorites),
    db
      .select({
        userId: orders.userId,
        productId: productVariants.productId,
        at: orders.createdAt,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
      .where(and(inArray(orders.status, [...PURCHASED_STATUSES]), isNotNull(orders.userId))),
  ])

  const vecById = new Map(vecRows.map((r) => [r.id, r.vector]))
  const activeSet = new Set(activeRows.map((r) => r.id))
  const candidates = vecRows.map((r) => r.id).filter((id) => activeSet.has(id))
  const dim = vecRows[0]?.vector.length ?? 0

  const sold = new Map(soldRows.map((r) => [r.productId, Number(r.n)]))
  const popular = [...candidates].sort((a, b) => (sold.get(b) ?? 0) - (sold.get(a) ?? 0))

  const positives = new Map<string, Map<string, number>>()
  const add = (userId: string | null, productId: string, at: Date) => {
    if (!userId || !activeSet.has(productId)) return
    const byProduct = positives.get(userId) ?? new Map<string, number>()
    byProduct.set(productId, Math.max(byProduct.get(productId) ?? 0, at.getTime()))
    positives.set(userId, byProduct)
  }
  for (const r of favRows) add(r.userId, r.productId, r.at)
  for (const r of buyRows) add(r.userId, r.productId, r.at)

  const acc = ks.map(() => ({ cbfP: 0, cbfR: 0, baseP: 0, baseR: 0 }))
  let users = 0

  for (const byProduct of positives.values()) {
    if (byProduct.size < 2) continue
    const ordered: Pointer[] = [...byProduct.entries()]
      .map(([id, at]) => ({ id, at }))
      .sort((a, b) => b.at - a.at)
    const test = ordered[0].id
    const trainIds = ordered.slice(1).map((p) => p.id)
    const trainSet = new Set(trainIds)
    const relevant = new Set([test])

    const profile = new Array<number>(dim).fill(0)
    let hasProfile = false
    for (const id of trainIds) {
      const vec = vecById.get(id)
      if (!vec || vec.length !== dim) continue
      for (let i = 0; i < dim; i++) profile[i] += vec[i]
      hasProfile = true
    }
    if (!hasProfile) continue

    const pool = candidates.filter((id) => !trainSet.has(id))
    const cbfRanked = [...pool].sort(
      (a, b) => cosineArrays(profile, vecById.get(b) ?? []) - cosineArrays(profile, vecById.get(a) ?? []),
    )
    const baseRanked = popular.filter((id) => !trainSet.has(id))

    users++
    ks.forEach((k, i) => {
      acc[i].cbfP += precisionAtK(cbfRanked, relevant, k)
      acc[i].cbfR += recallAtK(cbfRanked, relevant, k)
      acc[i].baseP += precisionAtK(baseRanked, relevant, k)
      acc[i].baseR += recallAtK(baseRanked, relevant, k)
    })
  }

  const avg = (total: number) => (users ? total / users : 0)
  const cbf: EvalMetric[] = ks.map((k, i) => ({
    k,
    precision: avg(acc[i].cbfP),
    recall: avg(acc[i].cbfR),
  }))
  const baseline: EvalMetric[] = ks.map((k, i) => ({
    k,
    precision: avg(acc[i].baseP),
    recall: avg(acc[i].baseR),
  }))

  return { users, candidates: candidates.length, ks: [...ks], cbf, baseline }
}

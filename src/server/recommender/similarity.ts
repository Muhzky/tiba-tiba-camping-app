import { eq } from 'drizzle-orm'
import { db } from '#/server/db'
import { productSimilarity, productVectors, products } from '#/server/db/schema'
import { rebuildProductVectors } from './vectorize'

export function cosine(a: Record<string, number>, b: Record<string, number>): number {
  const keys = Object.keys(a)
  if (!keys.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (const k of keys) {
    const av = a[k] ?? 0
    na += av * av
    nb += (b[k] ?? 0) * (b[k] ?? 0)
    dot += av * (b[k] ?? 0)
  }
  for (const k of Object.keys(b)) {
    if (!(k in a)) nb += (b[k] ?? 0) ** 2
  }
  if (!na || !nb) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

export function cosineArrays(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (!na || !nb) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

// ponytail: recompute pasangan penuh O(n²) — aman sampai ~5k produk;
// di atas itu, pindah ke blocking/inverted-index candidate generation.
export async function rebuildSimilarity(topN = 20): Promise<number> {
  const active = await db.select({ id: products.id }).from(products).where(eq(products.isActive, true))
  const activeIds = new Set(active.map((r) => r.id))
  const vecRows = await db
    .select({ productId: productVectors.productId, vector: productVectors.vector })
    .from(productVectors)
  const list = vecRows.filter((r) => activeIds.has(r.productId))

  const perProduct = new Map<string, Array<{ similarId: string; score: number }>>()
  const push = (from: string, to: string, score: number) => {
    const arr = perProduct.get(from) ?? []
    arr.push({ similarId: to, score })
    perProduct.set(from, arr)
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const score = Math.min(1, cosineArrays(list[i].vector, list[j].vector))
      if (score <= 0) continue
      push(list[i].productId, list[j].productId, score)
      push(list[j].productId, list[i].productId, score)
    }
  }

  const rows: Array<{ productId: string; similarId: string; score: number }> = []
  for (const [productId, arr] of perProduct) {
    arr.sort((a, b) => b.score - a.score)
    for (const item of arr.slice(0, topN)) {
      rows.push({ productId, similarId: item.similarId, score: item.score })
    }
  }

  await db.delete(productSimilarity)
  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(productSimilarity).values(rows.slice(i, i + 500))
  }
  return rows.length
}

export async function rebuildRecommender(): Promise<{
  products: number
  vocabSize: number
  pairs: number
}> {
  const vectors = await rebuildProductVectors()
  const pairs = await rebuildSimilarity()
  return { products: vectors.count, vocabSize: vectors.vocabSize, pairs }
}
